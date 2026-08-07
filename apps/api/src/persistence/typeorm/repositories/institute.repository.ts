import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository, type SelectQueryBuilder } from 'typeorm';

import {
  type CreateInstituteInput,
  type DuplicateCandidate,
  InstituteCodeAlreadyExistsError,
  InstituteContactEmailAlreadyExistsError,
  type InstitutePatch,
  type InstituteRecord,
  type InstituteRepository,
  type ListInstitutesFilters,
  type ListInstitutesQuery,
} from '../../../modules/institutes/ports';
import {
  InstituteCredentialEntity,
  InstituteEntity,
  InstituteQuestionAnswerEntity,
} from '../entities';
import { isUniqueViolation, violatedConstraint } from '../pg-errors';

/** Entity row -> the record the domain sees. Shared with the approval repository. */
export function toInstituteRecord(institute: InstituteEntity): InstituteRecord {
  return {
    id: institute.id,
    instituteCode: institute.instituteCode,
    numericCode: institute.numericCode,
    instituteName: institute.instituteName,
    branch: institute.branch,
    categoryId: institute.categoryId,
    institutionType: institute.institutionType,
    address: institute.address,
    city: institute.city,
    province: institute.province,
    postalCode: institute.postalCode,
    contactPersonName: institute.contactPersonName,
    contactPersonDesignation: institute.contactPersonDesignation,
    contactEmail: institute.contactEmail,
    contactPhone: institute.contactPhone,
    status: institute.status,
    rejectionReason: institute.rejectionReason,
    registrationSource: institute.registrationSource,
    approvedBy: institute.approvedBy,
    approvedAt: institute.approvedAt,
    createdAt: institute.createdAt,
    updatedAt: institute.updatedAt,
    answers: (institute.answers ?? []).map((answer) => ({
      questionId: answer.questionId,
      values: answer.values,
    })),
  };
}

@Injectable()
export class TypeOrmInstituteRepository implements InstituteRepository {
  constructor(
    @InjectRepository(InstituteEntity) private readonly institutes: Repository<InstituteEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(query: ListInstitutesQuery): Promise<InstituteRecord[]> {
    const rows = await this.filtered(this.institutes.createQueryBuilder('i'), query)
      .orderBy('i.created_at', 'DESC')
      .addOrderBy('i.id', 'DESC')
      .take(query.limit)
      .skip(query.offset)
      .getMany();
    if (rows.length === 0) return [];

    // Answers in one follow-up query rather than a join on the paged select: joining a one-to-many
    // before LIMIT is how a page of 25 silently becomes 25 × answers rows.
    const answers = await this.dataSource.getRepository(InstituteQuestionAnswerEntity).find({
      where: rows.map((row) => ({ instituteId: row.id })),
    });
    const byInstitute = new Map<string, InstituteQuestionAnswerEntity[]>();
    for (const answer of answers) {
      const list = byInstitute.get(answer.instituteId);
      if (list) list.push(answer);
      else byInstitute.set(answer.instituteId, [answer]);
    }
    return rows.map((row) =>
      toInstituteRecord(Object.assign(row, { answers: byInstitute.get(row.id) ?? [] })),
    );
  }

  count(filters: ListInstitutesFilters): Promise<number> {
    return this.filtered(this.institutes.createQueryBuilder('i'), filters).getCount();
  }

  async findById(id: string): Promise<InstituteRecord | null> {
    const found = await this.institutes.findOne({
      where: { id, deletedAt: undefined },
      relations: { answers: true },
    });
    // `deletedAt: undefined` does not filter, so the check is explicit — a soft-deleted institute
    // must be invisible to every read, exactly as a deleted user is.
    if (!found || found.deletedAt !== null) return null;
    return toInstituteRecord(found);
  }

  /** Mirrors the partial unique index exactly: rejected and deleted rows do not hold a code. */
  async isCodeTaken(instituteCode: string): Promise<boolean> {
    const count = await this.institutes
      .createQueryBuilder('i')
      .where('i.institute_code = :code', { code: instituteCode })
      .andWhere('i.status <> :rejected', { rejected: 'rejected' })
      .andWhere('i.deleted_at is null')
      .getCount();
    return count > 0;
  }

  /** Same terms as {@link isCodeTaken}: rejected and deleted rows release their address. */
  async isContactEmailTaken(contactEmail: string, excludeInstituteId?: string): Promise<boolean> {
    const qb = this.institutes
      .createQueryBuilder('i')
      // Addresses are compared case-insensitively. Nobody registering FOO@x.pk after
      // foo@x.pk thinks they have picked a different address, and the mail server agrees.
      .where('lower(i.contact_email) = lower(:email)', { email: contactEmail })
      .andWhere('i.status <> :rejected', { rejected: 'rejected' })
      .andWhere('i.deleted_at is null');
    if (excludeInstituteId) qb.andWhere('i.id <> :id', { id: excludeInstituteId });
    return (await qb.getCount()) > 0;
  }

  async create(input: CreateInstituteInput): Promise<InstituteRecord> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const numericCode = input.status === 'approved' ? await drawNumericCode(manager) : null;
        const now = new Date();

        const inserted = await manager
          .createQueryBuilder()
          .insert()
          .into(InstituteEntity)
          .values({
            instituteCode: input.instituteCode,
            instituteName: input.instituteName,
            branch: input.branch,
            categoryId: input.categoryId,
            institutionType: input.institutionType,
            address: input.address,
            city: input.city,
            province: input.province,
            postalCode: input.postalCode,
            contactPersonName: input.contactPersonName,
            contactPersonDesignation: input.contactPersonDesignation,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone,
            status: input.status,
            registrationSource: input.registrationSource,
            numericCode,
            approvedBy: input.status === 'approved' ? input.actorId : null,
            approvedAt: input.status === 'approved' ? now : null,
            createdBy: input.actorId,
            createdAt: now,
            updatedAt: now,
          })
          .returning('id')
          .execute();

        const id = (inserted.raw as Array<{ id: string }>)[0]?.id;
        if (!id) throw new Error('Institute insert returned no id');

        if (input.answers.length > 0) {
          await manager.getRepository(InstituteQuestionAnswerEntity).insert(
            input.answers.map((answer) => ({
              instituteId: id,
              questionId: answer.questionId,
              values: answer.values,
              createdAt: now,
            })),
          );
        }

        if (input.passwordHash) {
          await manager
            .getRepository(InstituteCredentialEntity)
            .insert({ instituteId: id, passwordHash: input.passwordHash, createdAt: now });
        }

        const saved = await manager.getRepository(InstituteEntity).findOne({
          where: { id },
          relations: { answers: true },
        });
        if (!saved) throw new Error('Institute vanished inside its own transaction');
        return toInstituteRecord(saved);
      });
    } catch (err) {
      // Two submissions can both pass the service's pre-check; the partial unique indexes catch
      // the loser. A 409 is the honest answer, not a 500 — and it must name the field that
      // actually clashed, so the applicant is not asked to change one they got right.
      if (isUniqueViolation(err)) {
        if (violatedConstraint(err) === 'institutes_contact_email_live_uq') {
          throw new InstituteContactEmailAlreadyExistsError(input.contactEmail);
        }
        throw new InstituteCodeAlreadyExistsError(input.instituteCode);
      }
      throw err;
    }
  }

  async update(
    id: string,
    patch: InstitutePatch,
    actorId: string | null,
  ): Promise<InstituteRecord | null> {
    const keys = Object.keys(patch);
    if (keys.length === 0) return this.findById(id);

    const result = await this.institutes
      .createQueryBuilder()
      .update(InstituteEntity)
      .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
      .where('id = :id', { id })
      .andWhere('deleted_at is null')
      .execute();

    return result.affected === 0 ? null : this.findById(id);
  }

  async softDelete(id: string, actorId: string): Promise<boolean> {
    const result = await this.institutes
      .createQueryBuilder()
      .update(InstituteEntity)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where('id = :id', { id })
      .andWhere('deleted_at is null')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async findDuplicateCandidates(
    instituteName: string,
    city: string,
    excludeId?: string,
  ): Promise<DuplicateCandidate[]> {
    const qb = this.institutes
      .createQueryBuilder('i')
      .select(['i.id', 'i.instituteName', 'i.branch', 'i.city', 'i.status'])
      .where('lower(i.institute_name) = lower(:name)', { name: instituteName })
      .andWhere('lower(i.city) = lower(:city)', { city })
      .andWhere('i.deleted_at is null')
      .orderBy('i.created_at', 'DESC')
      .limit(10);
    if (excludeId) qb.andWhere('i.id <> :excludeId', { excludeId });

    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      instituteName: row.instituteName,
      branch: row.branch,
      city: row.city,
      status: row.status,
    }));
  }

  /** Soft-deleted rows are excluded everywhere; the other filters are optional and combine with AND. */
  private filtered(
    qb: SelectQueryBuilder<InstituteEntity>,
    filters: ListInstitutesFilters,
  ): SelectQueryBuilder<InstituteEntity> {
    qb.where('i.deleted_at is null');
    if (filters.status) qb.andWhere('i.status = :status', { status: filters.status });
    if (filters.categoryId)
      qb.andWhere('i.category_id = :categoryId', { categoryId: filters.categoryId });
    if (filters.search) {
      qb.andWhere('(i.institute_name ilike :q or i.institute_code ilike :q or i.city ilike :q)', {
        q: `%${filters.search}%`,
      });
    }
    return qb;
  }
}

/**
 * Draw the next institute number.
 *
 * `nextval` rather than `max(numeric_code) + 1`: reading then writing is two steps, so two
 * approvals in the same moment would pick the same number and one would fail on a value nobody
 * typed. It also never reissues after a rollback, which is what we want — a reused number would
 * make an old student registration number point at a different institute.
 */
async function drawNumericCode(manager: EntityManager): Promise<number> {
  const rows = await manager.query<Array<{ nextval: number }>>(
    `select nextval('institute_numeric_code_seq')::integer as nextval`,
  );
  const next = rows[0]?.nextval;
  if (next === undefined) throw new Error('institute_numeric_code_seq returned no value');
  return next;
}
