import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { Institute } from '@oses/types';

import { AUTH_AUDIT_REPOSITORY, type AuthAuditRepository } from '../../auth/ports';
import { SYSTEM_ROLE_IDS } from '../../rbac/system-roles';
import { hashPassword } from '../../shared/crypto';
import type { ApproveInstituteDto, RejectInstituteDto, UpdateInstituteStatusDto } from './dto';
import { toAdminInstitute } from './institute-mapper';
import {
  ACCOUNT_LOOKUP,
  type AccountLookup,
  type ApprovalLogin,
  INSTITUTE_APPROVAL_REPOSITORY,
  INSTITUTE_CREDENTIAL_REPOSITORY,
  INSTITUTE_DEPENDANTS,
  INSTITUTE_REPOSITORY,
  type InstituteApprovalRepository,
  type InstituteCredentialRepository,
  type InstituteDependants,
  type InstituteRecord,
  type InstituteRepository,
} from './ports';

export interface ApprovalResult {
  institute: Institute;
  /** The account created alongside the approval, or null when none was asked for. */
  userId: string | null;
  message: string;
}

/**
 * The state changes that are transactions rather than statements: approve, reject, and
 * deactivate.
 *
 * Separated from `InstitutesService` because the interesting part of each is what happens when a
 * step fails halfway. Keeping them here means the atomicity has one home, and it is obvious which
 * operations have it.
 */
@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @Inject(INSTITUTE_REPOSITORY) private readonly institutes: InstituteRepository,
    @Inject(INSTITUTE_APPROVAL_REPOSITORY)
    private readonly approvals: InstituteApprovalRepository,
    @Inject(INSTITUTE_CREDENTIAL_REPOSITORY)
    private readonly credentials: InstituteCredentialRepository,
    @Inject(ACCOUNT_LOOKUP) private readonly accounts: AccountLookup,
    @Inject(INSTITUTE_DEPENDANTS) private readonly dependants: InstituteDependants,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly audit: AuthAuditRepository,
  ) {}

  /**
   * Approve & Register — one button, four writes, all or nothing.
   *
   * The email is checked here for a readable message, and again by the users table's unique
   * index inside the transaction. Likewise the `pending` status: this method reads it, and the
   * transaction re-asserts it in a `where` clause. Both pre-checks exist to produce a good error,
   * never to be the guarantee — weeks can pass between a registration and its approval, and two
   * super admins can press the button in the same second.
   */
  async approve(
    instituteId: string,
    dto: ApproveInstituteDto,
    actorId: string,
  ): Promise<ApprovalResult> {
    const institute = await this.requirePending(instituteId);
    const login = dto.createLogin ? await this.buildLogin(institute, dto) : null;

    const result = await this.approvals.approve({ instituteId, approvedBy: actorId, login });

    switch (result.outcome) {
      case 'not-found':
        throw new NotFoundException('Institute not found');
      case 'not-pending':
        // Someone approved or rejected it between the read above and the transaction. The guard
        // inside the transaction is what makes this a 409 rather than a second account.
        throw new ConflictException('This institute is no longer awaiting approval.');
      case 'email-taken':
        throw new ConflictException(
          `${institute.contactEmail} already has an account. Change the institute's contact ` +
            'email, or approve without creating a login and link the existing account.',
        );
      case 'approved':
        // The account this just minted is an auth event by the table's own charter, and the
        // same one `users.service.ts` writes when an admin creates a login by hand. The
        // institute's own lifecycle is recorded on its row (approved_by / approved_at); a
        // general audit log for non-auth events is deliberately its own piece of work.
        if (result.userId) {
          await this.audit.record({
            event: 'user.created',
            actorId,
            userId: result.userId,
            metadata: { instituteId, via: 'institute.approval' },
          });
        }
        return {
          institute: toAdminInstitute(result.institute),
          userId: result.userId,
          message: result.userId
            ? `Institute approved. ${institute.contactEmail} can now sign in.`
            : 'Institute approved. No login was created.',
        };
    }
  }

  /**
   * Reject an application. The row stays, with its reason, as the record of who applied and was
   * turned away — but the code is freed by the partial unique index, so the institute can apply
   * again once whatever was wrong is fixed.
   */
  async reject(
    instituteId: string,
    dto: RejectInstituteDto,
    actorId: string,
  ): Promise<{ institute: Institute; message: string }> {
    await this.requirePending(instituteId);
    const result = await this.approvals.reject({
      instituteId,
      reason: dto.reason,
      rejectedBy: actorId,
    });

    switch (result.outcome) {
      case 'not-found':
        throw new NotFoundException('Institute not found');
      case 'not-pending':
        throw new ConflictException('This institute is no longer awaiting approval.');
      case 'rejected':
        return {
          institute: toAdminInstitute(result.institute),
          message: 'Application rejected. The institute code is free to be registered again.',
        };
    }
  }

  /**
   * Deactivate or reactivate.
   *
   * **The order matters and is the point of this method.** Dependants are switched off first and
   * the institute's own status last, because of which half-finished state is survivable:
   *
   * - status first, cascade fails → the institute reads as deactivated while its staff can still
   *   sign in. That is a hole.
   * - cascade first, status fails → accounts are off, the institute still reads as approved. No
   *   hole, an incomplete action, and pressing the button again finishes it.
   *
   * Allocations are released before the evaluators holding them are switched off, or the work
   * would be stranded on an account that can no longer act on it. Students, evaluators and
   * allocations are placeholders today; the ordering ships now so the module that fills them in
   * inherits it rather than having to rediscover it.
   */
  async setStatus(
    instituteId: string,
    dto: UpdateInstituteStatusDto,
    actorId: string,
  ): Promise<{ institute: Institute; message: string }> {
    const institute = await this.requireInstitute(instituteId);
    if (institute.status === 'pending' || institute.status === 'rejected') {
      throw new BadRequestException(
        'Only an approved institute can be deactivated. Approve or reject this application first.',
      );
    }

    if (dto.status === 'deactivated') {
      await this.dependants.releaseAllocations(instituteId);
      await this.dependants.deactivateEvaluators(instituteId);
      await this.dependants.deactivateStudents(instituteId);
      const users = await this.dependants.deactivateUsers(instituteId, 'institute_deactivated');
      this.logger.log(`Institute ${instituteId} deactivated; ${users} account(s) switched off.`);
      // Switching off a batch of accounts is an account-status change, which this table exists
      // to record. Without it the single-user path is audited and the bulk path is not — and
      // the bulk one is the harder to reconstruct afterwards.
      if (users > 0) {
        await this.audit.record({
          event: 'account.status',
          actorId,
          metadata: {
            instituteId,
            status: 'deactivate',
            accounts: users,
            via: 'institute.deactivation',
          },
        });
      }
    }

    const updated = await this.approvals.setStatus(instituteId, dto.status, actorId);
    if (!updated) throw new NotFoundException('Institute not found');

    return {
      institute: toAdminInstitute(updated),
      message:
        dto.status === 'deactivated'
          ? 'Institute deactivated. Its accounts can no longer sign in.'
          : 'Institute reactivated. Its accounts must be switched back on individually.',
    };
  }

  /**
   * Resolve the password for the account being created.
   *
   * A public applicant chose one at registration, and it has been sitting hashed in its own table
   * ever since. An institute a super admin entered directly has none, so one must be supplied —
   * refusing is better than inventing a password nobody was told.
   */
  private async buildLogin(
    institute: InstituteRecord,
    dto: ApproveInstituteDto,
  ): Promise<ApprovalLogin> {
    const stored = await this.credentials.find(institute.id);
    const passwordHash = dto.password ? await hashPassword(dto.password) : stored;

    if (!passwordHash) {
      throw new BadRequestException(
        'This application has no password on file. Supply one to create the login, or approve ' +
          'without creating a login.',
      );
    }

    if (await this.accounts.isEmailTaken(institute.contactEmail)) {
      throw new ConflictException(
        `${institute.contactEmail} already has an account. Change the institute's contact ` +
          'email, or approve without creating a login and link the existing account.',
      );
    }

    return {
      email: institute.contactEmail,
      fullName: dto.fullName ?? institute.contactPersonName,
      passwordHash,
      roleId: SYSTEM_ROLE_IDS.institute,
    };
  }

  private async requirePending(instituteId: string): Promise<InstituteRecord> {
    const institute = await this.requireInstitute(instituteId);
    if (institute.status !== 'pending') {
      throw new ConflictException('This institute is no longer awaiting approval.');
    }
    return institute;
  }

  private async requireInstitute(instituteId: string): Promise<InstituteRecord> {
    const institute = await this.institutes.findById(instituteId);
    if (!institute) throw new NotFoundException('Institute not found');
    return institute;
  }
}
