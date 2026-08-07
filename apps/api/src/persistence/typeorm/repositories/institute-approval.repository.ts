import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import type { InstituteStatus } from '@oses/types';

import type {
  ApproveInstituteInput,
  ApproveOutcome,
  InstituteApprovalRepository,
  InstituteRecord,
  RejectInstituteInput,
  RejectOutcome,
} from '../../../modules/institutes/ports';
import { InstituteCredentialEntity, InstituteEntity, SessionEntity, UserEntity } from '../entities';
import { isUniqueViolation } from '../pg-errors';
import { toInstituteRecord } from './institute.repository';

@Injectable()
export class TypeOrmInstituteApprovalRepository implements InstituteApprovalRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async approve(input: ApproveInstituteInput): Promise<ApproveOutcome> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const institute = await manager
          .getRepository(InstituteEntity)
          .findOne({ where: { id: input.instituteId } });
        if (!institute || institute.deletedAt !== null) return { outcome: 'not-found' };

        const now = new Date();
        const numericCode = await drawNumericCode(manager);

        // The `status = 'pending'` guard is the real protection, not the service's pre-read. Two
        // approvals in the same second both pass that read; only one updates a row here, and the
        // loser reports `not-pending` instead of minting a second account.
        const flipped = await manager
          .createQueryBuilder()
          .update(InstituteEntity)
          .set({
            status: 'approved',
            numericCode,
            approvedBy: input.approvedBy,
            approvedAt: now,
            updatedBy: input.approvedBy,
            updatedAt: now,
          })
          .where('id = :id', { id: input.instituteId })
          .andWhere('status = :pending', { pending: 'pending' })
          .andWhere('deleted_at is null')
          .execute();

        if (flipped.affected === 0) return { outcome: 'not-pending' };

        let userId: string | null = null;
        if (input.login) {
          const inserted = await manager
            .createQueryBuilder()
            .insert()
            .into(UserEntity)
            .values({
              email: input.login.email,
              passwordHash: input.login.passwordHash,
              roleId: input.login.roleId,
              instituteId: input.instituteId,
              fullName: input.login.fullName,
              status: 'active',
              createdBy: input.approvedBy,
              createdAt: now,
              updatedAt: now,
            })
            .returning('id')
            .execute();
          userId = (inserted.raw as Array<{ id: string }>)[0]?.id ?? null;
        }

        // The credential has done its job. Deleting it inside the same transaction means an
        // approval that rolls back leaves it intact for the retry, and one that succeeds leaves
        // nothing behind.
        await manager
          .getRepository(InstituteCredentialEntity)
          .delete({ instituteId: input.instituteId });

        return { outcome: 'approved', institute: await reload(manager, input.instituteId), userId };
      });
    } catch (err) {
      // The users table's unique index catching an address taken between the service's check and
      // this transaction. A 409 is the honest answer; the whole approval has already rolled back.
      if (isUniqueViolation(err)) return { outcome: 'email-taken' };
      throw err;
    }
  }

  async reject(input: RejectInstituteInput): Promise<RejectOutcome> {
    return this.dataSource.transaction(async (manager) => {
      const institute = await manager
        .getRepository(InstituteEntity)
        .findOne({ where: { id: input.instituteId } });
      if (!institute || institute.deletedAt !== null) return { outcome: 'not-found' };

      const now = new Date();
      const flipped = await manager
        .createQueryBuilder()
        .update(InstituteEntity)
        .set({
          status: 'rejected',
          rejectionReason: input.reason,
          updatedBy: input.rejectedBy,
          updatedAt: now,
        })
        .where('id = :id', { id: input.instituteId })
        .andWhere('status = :pending', { pending: 'pending' })
        .andWhere('deleted_at is null')
        .execute();

      if (flipped.affected === 0) return { outcome: 'not-pending' };

      // Nothing lingers: a rejected application keeps its record but not its password.
      await manager
        .getRepository(InstituteCredentialEntity)
        .delete({ instituteId: input.instituteId });

      return { outcome: 'rejected', institute: await reload(manager, input.instituteId) };
    });
  }

  async setStatus(
    instituteId: string,
    status: Extract<InstituteStatus, 'approved' | 'deactivated'>,
    actorId: string,
  ): Promise<InstituteRecord | null> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(InstituteEntity)
        .set({ status, updatedBy: actorId, updatedAt: new Date() })
        .where('id = :id', { id: instituteId })
        .andWhere('deleted_at is null')
        // A pending or rejected application has no numeric code, and the check constraint would
        // refuse the row. Guarding here turns that into a clean "nothing changed" instead.
        .andWhere('status in (:...allowed)', { allowed: ['approved', 'deactivated'] })
        .execute();

      if (result.affected === 0) return null;

      // Deactivating also revokes every open session. Setting the users' status alone stops the
      // guards on the next request, but a live refresh token would still mint a new access token.
      if (status === 'deactivated') {
        await manager
          .createQueryBuilder()
          .update(SessionEntity)
          .set({ revokedAt: new Date(), revokedReason: 'institute_deactivated' })
          .where('revoked_at is null')
          .andWhere('user_id in (select "id" from "users" where "institute_id" = :instituteId)', {
            instituteId,
          })
          .execute();
      }

      return reload(manager, instituteId);
    });
  }
}

async function reload(manager: EntityManager, instituteId: string): Promise<InstituteRecord> {
  const saved = await manager
    .getRepository(InstituteEntity)
    .findOne({ where: { id: instituteId }, relations: { answers: true } });
  if (!saved) throw new Error('Institute vanished inside its own transaction');
  return toInstituteRecord(saved);
}

/**
 * `nextval` rather than `max(numeric_code) + 1` — see the note on the same helper in
 * `institute.repository.ts`. Drawn inside the transaction, so a rollback simply leaves a gap;
 * gaps are harmless, a reused number is not.
 */
async function drawNumericCode(manager: EntityManager): Promise<number> {
  const rows = await manager.query<Array<{ nextval: number }>>(
    `select nextval('institute_numeric_code_seq')::integer as nextval`,
  );
  const next = rows[0]?.nextval;
  if (next === undefined) throw new Error('institute_numeric_code_seq returned no value');
  return next;
}
