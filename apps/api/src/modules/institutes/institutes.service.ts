import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { hashPassword } from '../../shared/crypto';
import { validateAnswers } from './answer-validator';
import type {
  CheckAvailabilityDto,
  CreateInstituteRequestDto,
  ListInstitutesQueryDto,
  RegisterInstituteRequestDto,
  UpdateInstituteRequestDto,
} from './dto';
import {
  type AdminInstitute,
  type DuplicateWarning,
  toAdminInstitute,
  toDuplicateWarning,
} from './institute-mapper';
import {
  ACCOUNT_LOOKUP,
  type AccountLookup,
  CATEGORY_LOOKUP,
  type CategoryLookup,
  type CategorySummary,
  INSTITUTE_DEPENDANTS,
  INSTITUTE_REPOSITORY,
  type InstituteAnswerRecord,
  InstituteCodeAlreadyExistsError,
  type InstituteDependantCounts,
  type InstituteDependants,
  type InstituteDetailsInput,
  type InstituteRecord,
  type InstituteRepository,
} from './ports';
import {
  type AvailabilityResult,
  type RegistrationReceipt,
  toRegistrationReceipt,
} from './public-institute-mapper';

/** One wording for both routes to it: the pre-check, and the database losing the race. */
const CODE_TAKEN = 'An institute is already registered with that code.';

export interface PaginatedInstitutes {
  items: AdminInstitute[];
  total: number;
}

export interface InstituteDetail extends AdminInstitute {
  /** Live institutes with the same name and city. A prompt for a human, never a block. */
  possibleDuplicates: DuplicateWarning[];
}

/**
 * Institute registration and the directory around it.
 *
 * Approval, rejection and deactivation are deliberately **not** here — they live in
 * `ApprovalService`, because each is a multi-step transaction whose failure modes are the
 * interesting part. This service owns everything that is a single write.
 */
@Injectable()
export class InstitutesService {
  constructor(
    @Inject(INSTITUTE_REPOSITORY) private readonly institutes: InstituteRepository,
    @Inject(CATEGORY_LOOKUP) private readonly categories: CategoryLookup,
    @Inject(ACCOUNT_LOOKUP) private readonly accounts: AccountLookup,
    @Inject(INSTITUTE_DEPENDANTS) private readonly dependants: InstituteDependants,
  ) {}

  /**
   * Public self-registration. Creates one `pending` row and nothing else — no login, no
   * permission, no access — until a super admin approves it.
   */
  async register(dto: RegisterInstituteRequestDto): Promise<RegistrationReceipt> {
    const answers = await this.validateSubmission(dto.categoryId, dto.instituteCode, dto.answers);
    const passwordHash = await hashPassword(dto.password);

    const record = await this.insert({
      details: toDetails(dto),
      answers,
      status: 'pending',
      source: 'public',
      passwordHash,
      actorId: null,
    });
    return toRegistrationReceipt(record);
  }

  /**
   * A super admin entering an institute directly. Lands `approved` immediately: making the
   * approver approve their own entry is ceremony, not a control.
   */
  async createByAdmin(dto: CreateInstituteRequestDto, actorId: string): Promise<AdminInstitute> {
    const answers = await this.validateSubmission(dto.categoryId, dto.instituteCode, dto.answers);
    const record = await this.insert({
      details: toDetails(dto),
      answers,
      status: 'approved',
      source: 'admin',
      passwordHash: null,
      actorId,
    });
    return toAdminInstitute(record);
  }

  /** A page of institutes, newest first, plus the total under the same filters. */
  async listInstitutes(query: ListInstitutesQueryDto): Promise<PaginatedInstitutes> {
    const filters = { search: query.q, status: query.status, categoryId: query.categoryId };
    const [rows, total] = await Promise.all([
      this.institutes.list({ ...filters, limit: query.limit, offset: query.offset }),
      // The same filters as the page, so "showing 10 of 3" cannot happen.
      this.institutes.count(filters),
    ]);
    return { items: rows.map(toAdminInstitute), total };
  }

  /** One institute, with the duplicate warning the approval screen needs. */
  async getInstitute(id: string): Promise<InstituteDetail> {
    const record = await this.requireInstitute(id);
    const duplicates = await this.institutes.findDuplicateCandidates(
      record.instituteName,
      record.city,
      record.id,
    );
    return {
      ...toAdminInstitute(record),
      possibleDuplicates: duplicates.map(toDuplicateWarning),
    };
  }

  /**
   * Edit the fields that stay editable after approval.
   *
   * The locked ones — institute code, category, answers, numeric code — are absent from
   * `UpdateInstituteSchema`, so `.strict()` has already answered 400 naming the field before
   * anything reaches here. That is deliberate: a caller who cannot tell "ignored" from "saved"
   * will believe the change applied.
   */
  async updateInstitute(
    id: string,
    dto: UpdateInstituteRequestDto,
    actorId: string,
  ): Promise<AdminInstitute> {
    await this.requireInstitute(id);
    const updated = await this.institutes.update(id, dto, actorId);
    if (!updated) throw new NotFoundException('Institute not found');
    return toAdminInstitute(updated);
  }

  /**
   * Soft delete, allowed only while nothing is attached.
   *
   * That narrowness is the whole point. An institute with students or exams behind it is the root
   * of records a board must still be able to produce years later, so deactivation is the only way
   * out for those. This covers the case deactivation handles badly: approved by mistake, or a
   * duplicate — where there is no chain to break and the code should be freed for a correct entry.
   */
  async deleteInstitute(id: string, actorId: string): Promise<{ message: string }> {
    const record = await this.requireInstitute(id);
    const counts = await this.dependants.count(record.id);
    const attached = describeAttachments(counts);
    if (attached) {
      throw new BadRequestException(
        `This institute cannot be deleted because it has ${attached}. Deactivate it instead.`,
      );
    }

    const deleted = await this.institutes.softDelete(record.id);
    if (!deleted) throw new NotFoundException('Institute not found');
    void actorId;
    return { message: 'Institute deleted.' };
  }

  /**
   * Whether a code and/or an email are free, for the step-boundary check on the public form.
   *
   * This does confirm that a code or an email exists, which is normally avoided. The trade-off was
   * taken deliberately: these are institutions rather than individuals, the volume is small, the
   * route is rate-limited, and with no email service there is no other way to tell an applicant
   * before they have filled in fifteen more fields. Fields not asked about answer `null` rather
   * than a guess.
   */
  async checkAvailability(dto: CheckAvailabilityDto): Promise<AvailabilityResult> {
    const [codeTaken, emailTaken] = await Promise.all([
      dto.instituteCode === undefined
        ? Promise.resolve(null)
        : this.institutes.isCodeTaken(dto.instituteCode),
      dto.contactEmail === undefined
        ? Promise.resolve(null)
        : this.accounts.isEmailTaken(dto.contactEmail),
    ]);
    return {
      codeAvailable: codeTaken === null ? null : !codeTaken,
      emailAvailable: emailTaken === null ? null : !emailTaken,
    };
  }

  /** Both entry paths share every rule that matters, so they share one implementation. */
  private async validateSubmission(
    categoryId: string,
    instituteCode: string,
    answers: RegisterInstituteRequestDto['answers'],
  ): Promise<InstituteAnswerRecord[]> {
    const category = await this.requireActiveCategory(categoryId);

    const validation = validateAnswers(category, answers ?? []);
    if (!validation.ok) throw new BadRequestException(validation.problem.message);

    // A pre-check for a readable message. The partial unique index is what actually guarantees
    // it — two submissions can both pass here, and the loser is caught at insert.
    if (await this.institutes.isCodeTaken(instituteCode)) {
      throw new ConflictException(CODE_TAKEN);
    }
    return validation.answers;
  }

  private async insert(input: {
    details: InstituteDetailsInput;
    answers: InstituteAnswerRecord[];
    status: 'pending' | 'approved';
    source: 'public' | 'admin';
    passwordHash: string | null;
    actorId: string | null;
  }): Promise<InstituteRecord> {
    try {
      return await this.institutes.create({
        ...input.details,
        answers: input.answers,
        status: input.status,
        registrationSource: input.source,
        passwordHash: input.passwordHash,
        actorId: input.actorId,
      });
    } catch (err) {
      if (err instanceof InstituteCodeAlreadyExistsError) {
        throw new ConflictException(CODE_TAKEN);
      }
      throw err;
    }
  }

  private async requireActiveCategory(categoryId: string): Promise<CategorySummary> {
    const category = await this.categories.findById(categoryId);
    if (!category) throw new BadRequestException('Unknown institute category');
    if (!category.isActive) {
      throw new BadRequestException('That institute category is no longer accepting registrations');
    }
    return category;
  }

  private async requireInstitute(id: string): Promise<InstituteRecord> {
    const record = await this.institutes.findById(id);
    if (!record) throw new NotFoundException('Institute not found');
    return record;
  }
}

/** Every field of the shared block, named explicitly so a new DTO field cannot slip through. */
function toDetails(dto: CreateInstituteRequestDto): InstituteDetailsInput {
  return {
    instituteCode: dto.instituteCode,
    instituteName: dto.instituteName,
    branch: dto.branch ?? null,
    categoryId: dto.categoryId,
    institutionType: dto.institutionType,
    address: dto.address,
    city: dto.city,
    province: dto.province,
    postalCode: dto.postalCode ?? null,
    contactPersonName: dto.contactPersonName,
    contactPersonDesignation: dto.contactPersonDesignation,
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
  };
}

/** "3 users and 120 students", or null when nothing is attached. */
function describeAttachments(counts: InstituteDependantCounts): string | null {
  const parts: string[] = [];
  if (counts.users > 0) parts.push(plural(counts.users, 'user'));
  if (counts.students > 0) parts.push(plural(counts.students, 'student'));
  if (counts.exams > 0) parts.push(plural(counts.exams, 'exam'));
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]!}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
