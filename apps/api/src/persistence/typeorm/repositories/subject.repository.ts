import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import {
  type CreateSubjectInput,
  SubjectCodeAlreadyExistsError,
  type SubjectPatch,
  type SubjectRecord,
  type SubjectRepository,
} from '../../../modules/subjects/ports';
import { SubjectEntity } from '../entities';
import { isUniqueViolation } from '../pg-errors';

function toRecord(subject: SubjectEntity): SubjectRecord {
  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    isActive: subject.isActive,
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
  };
}

/** Only the keys actually present are written, so an absent field is left untouched. */
function patchToSet(patch: SubjectPatch): QueryDeepPartialEntity<SubjectEntity> {
  const set: QueryDeepPartialEntity<SubjectEntity> = {};
  if (patch.code !== undefined) set.code = patch.code;
  if (patch.name !== undefined) set.name = patch.name;
  return set;
}

@Injectable()
export class TypeOrmSubjectRepository implements SubjectRepository {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly repo: Repository<SubjectEntity>,
  ) {}

  async list(opts: { activeOnly: boolean }): Promise<SubjectRecord[]> {
    const qb = this.repo
      .createQueryBuilder('subject')
      // Subjects are read by people, so they sort by the name people see. LOWER() keeps that
      // order case-insensitive whatever collation the database was created with — otherwise
      // "algebra" could sort after "Zoology". `code` is the tie-break, so two subjects sharing a
      // name still come back in a stable order.
      .orderBy('LOWER("subject"."name")', 'ASC')
      .addOrderBy('subject.code', 'ASC');

    // Filtered in SQL, never in memory afterwards — an in-memory filter is the kind a later
    // refactor drops silently, and this one decides what a picker is allowed to offer.
    if (opts.activeOnly) qb.andWhere('subject.isActive = true');

    const rows = await qb.getMany();
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<SubjectRecord | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateSubjectInput): Promise<SubjectRecord> {
    let id: string;
    try {
      const saved = await this.repo.save(
        this.repo.create({
          code: input.code,
          name: input.name,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        }),
      );
      id = saved.id;
    } catch (err) {
      if (isUniqueViolation(err)) throw new SubjectCodeAlreadyExistsError(input.code);
      throw err;
    }

    // Re-read so the DB-defaulted columns (timestamps, is_active) are returned exactly as
    // stored rather than as whatever the in-memory entity happened to hold.
    const created = await this.findById(id);
    if (!created) throw new Error(`subject ${id} vanished immediately after creation`);
    return created;
  }

  async update(
    id: string,
    patch: SubjectPatch,
    actorId: string | null,
  ): Promise<SubjectRecord | null> {
    try {
      const result = await this.repo
        .createQueryBuilder()
        .update(SubjectEntity)
        .set({ ...patchToSet(patch), updatedAt: new Date(), updatedBy: actorId })
        .where('id = :id', { id })
        .returning('id')
        .execute();

      if (!(result.raw as Array<{ id: string }>)[0]) return null;
    } catch (err) {
      // The only unique constraint on this table is on `code`, and `patchToSet` writes `code`
      // only when the patch carries one — so a 23505 here can have no other source.
      if (isUniqueViolation(err) && patch.code !== undefined) {
        throw new SubjectCodeAlreadyExistsError(patch.code);
      }
      throw err;
    }

    return this.findById(id);
  }

  async setActive(
    id: string,
    isActive: boolean,
    actorId: string | null,
  ): Promise<SubjectRecord | null> {
    const result = await this.repo
      .createQueryBuilder()
      .update(SubjectEntity)
      .set({ isActive, updatedAt: new Date(), updatedBy: actorId })
      .where('id = :id', { id })
      .returning('id')
      .execute();

    if (!(result.raw as Array<{ id: string }>)[0]) return null;
    return this.findById(id);
  }
}
