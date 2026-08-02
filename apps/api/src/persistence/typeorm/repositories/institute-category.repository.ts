import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import {
  type ApplyUpdateInput,
  type ApplyUpdateOutcome,
  CategoryCodeAlreadyExistsError,
  CategoryInUseError,
  type CategoryPatch,
  type CategoryQuestionRecord,
  type CreateInstituteCategoryInput,
  type InstituteCategoryRecord,
  type InstituteCategoryRepository,
  type QuestionMutationPlan,
} from '../../../modules/institute-categories/ports';
import { InstituteCategoryEntity, InstituteCategoryQuestionEntity } from '../entities';
import { isForeignKeyViolation, isUniqueViolation } from '../pg-errors';

function toQuestionRecord(question: InstituteCategoryQuestionEntity): CategoryQuestionRecord {
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    required: question.required,
    options: question.options,
    sortOrder: question.sortOrder,
    isActive: question.isActive,
  };
}

function toRecord(category: InstituteCategoryEntity): InstituteCategoryRecord {
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    version: category.version,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    questions: (category.questions ?? []).map(toQuestionRecord),
  };
}

/** Only the keys actually present are written, so an absent field is left untouched. */
function patchToSet(patch: CategoryPatch): QueryDeepPartialEntity<InstituteCategoryEntity> {
  const set: QueryDeepPartialEntity<InstituteCategoryEntity> = {};
  if (patch.code !== undefined) set.code = patch.code;
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  return set;
}

@Injectable()
export class TypeOrmInstituteCategoryRepository implements InstituteCategoryRepository {
  constructor(
    @InjectRepository(InstituteCategoryEntity)
    private readonly repo: Repository<InstituteCategoryEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(opts: { activeOnly: boolean }): Promise<InstituteCategoryRecord[]> {
    // One query, one join — never a query per category. `activeOnly` filters in SQL at both
    // levels (a LEFT JOIN, so a category with no active questions is still returned) rather
    // than in memory afterwards, which a later refactor could silently drop.
    const qb = this.repo
      .createQueryBuilder('category')
      .leftJoinAndSelect(
        'category.questions',
        'question',
        opts.activeOnly ? 'question.isActive = true' : undefined,
      )
      // Categories are read by people, so they sort by the name people see. LOWER() keeps that
      // order case-insensitive whatever collation the database was created with — otherwise
      // "academy" could sort after "Zebra". `code` is the tie-break, so two categories sharing
      // a name still come back in a stable order.
      .orderBy('LOWER("category"."name")', 'ASC')
      .addOrderBy('category.code', 'ASC')
      // createdAt breaks ties among questions: a retired question keeps the sortOrder it had
      // when it was retired, so it can collide with a later active one. Neither view shows
      // retired questions, so this is not about what an admin sees — it keeps the raw result
      // deterministic, which tests and debugging depend on.
      .addOrderBy('question.sortOrder', 'ASC')
      .addOrderBy('question.createdAt', 'ASC');

    if (opts.activeOnly) qb.andWhere('category.isActive = true');

    const rows = await qb.getMany();
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<InstituteCategoryRecord | null> {
    const row = await this.repo
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.questions', 'question')
      .where('category.id = :id', { id })
      .orderBy('question.sortOrder', 'ASC')
      .addOrderBy('question.createdAt', 'ASC')
      .getOne();
    return row ? toRecord(row) : null;
  }

  async create(input: CreateInstituteCategoryInput): Promise<InstituteCategoryRecord> {
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const categories = manager.getRepository(InstituteCategoryEntity);
        const saved = await categories.save(
          categories.create({
            code: input.code,
            name: input.name,
            description: input.description,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }),
        );
        await this.insertQuestions(manager, saved.id, input.questions);
        return saved.id;
      });

      // Re-read so DB-defaulted columns (version, timestamps, generated question ids) are
      // returned exactly as stored.
      const created = await this.findById(id);
      if (!created) throw new Error(`institute category ${id} vanished immediately after creation`);
      return created;
    } catch (err) {
      if (isUniqueViolation(err)) throw new CategoryCodeAlreadyExistsError(input.code);
      throw err;
    }
  }

  async applyUpdate(input: ApplyUpdateInput): Promise<ApplyUpdateOutcome> {
    try {
      const claimed = await this.dataSource.transaction(async (manager) => {
        // Conditional update: the row is only touched while it still carries the version the
        // caller loaded. A concurrent save has already bumped it, so this matches nothing and
        // the whole transaction — including every question change — is abandoned.
        const claim = await manager
          .createQueryBuilder()
          .update(InstituteCategoryEntity)
          .set({
            ...patchToSet(input.patch),
            version: () => '"version" + 1',
            updatedAt: new Date(),
            updatedBy: input.actorId,
          })
          .where('id = :id', { id: input.id })
          .andWhere('version = :expectedVersion', { expectedVersion: input.expectedVersion })
          .returning('id')
          .execute();

        if ((claim.raw as Array<{ id: string }>)[0]) {
          await this.applyPlan(manager, input.id, input.plan);
          return 'updated' as const;
        }

        // Zero rows matched for one of two reasons that mean very different things to the
        // caller. Resolve it inside the same transaction so the answer cannot itself be racy.
        const stillExists =
          (await manager
            .getRepository(InstituteCategoryEntity)
            .count({ where: { id: input.id } })) > 0;
        return stillExists ? ('version-conflict' as const) : ('not-found' as const);
      });

      if (claimed !== 'updated') return { outcome: claimed };

      const category = await this.findById(input.id);
      if (!category) throw new Error(`institute category ${input.id} vanished mid-update`);
      return { outcome: 'updated', category };
    } catch (err) {
      // The only unique constraint on this table is on `code`, and `patchToSet` writes `code`
      // only when the patch carries one — so a 23505 here can have no other source.
      if (isUniqueViolation(err) && input.patch.code !== undefined) {
        throw new CategoryCodeAlreadyExistsError(input.patch.code);
      }
      throw err;
    }
  }

  async setActive(
    id: string,
    isActive: boolean,
    actorId: string | null,
  ): Promise<InstituteCategoryRecord | null> {
    // Bumps the version too, so an editor holding a stale copy is told to reload rather than
    // silently overwriting the switch.
    const result = await this.repo
      .createQueryBuilder()
      .update(InstituteCategoryEntity)
      .set({
        isActive,
        version: () => '"version" + 1',
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where('id = :id', { id })
      .returning('id')
      .execute();

    if (!(result.raw as Array<{ id: string }>)[0]) return null;
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    try {
      const result = await this.repo.delete({ id });
      return (result.affected ?? 0) > 0;
    } catch (err) {
      // On a DELETE the only foreign key that can fire points AT this row, so the meaning is
      // unambiguous: something still references the category. Translated here rather than left
      // raw so the caller answers 409 instead of 500 — this is what closes the gap between the
      // service's in-use pre-check and the delete itself. (Questions cascade, so they are never
      // the cause; the first real referrer arrives with the institutes table.)
      if (isForeignKeyViolation(err)) throw new CategoryInUseError(id);
      throw err;
    }
  }

  private async applyPlan(
    manager: EntityManager,
    categoryId: string,
    plan: QuestionMutationPlan,
  ): Promise<void> {
    const questions = manager.getRepository(InstituteCategoryQuestionEntity);
    const now = new Date();

    // Every statement is scoped by `categoryId` as well as by id. The ids in a plan always
    // originate from this category, but the repository is the boundary that must hold even if a
    // future caller hands over a plan built somewhere else — an unscoped delete would otherwise
    // strand answers belonging to a completely different category.
    if (plan.remove.length > 0) {
      await questions.delete({ id: In(plan.remove), categoryId });
    }

    if (plan.deactivate.length > 0) {
      await questions.update(
        { id: In(plan.deactivate), categoryId },
        { isActive: false, updatedAt: now },
      );
    }

    // Question counts are single digits by validation (max 50), so per-row updates are cheaper
    // than building a bulk CASE statement and far easier to read.
    for (const question of plan.update) {
      await questions.update(
        { id: question.id, categoryId },
        {
          text: question.text,
          type: question.type,
          required: question.required,
          options: question.options,
          sortOrder: question.sortOrder,
          isActive: question.isActive,
          updatedAt: now,
        },
      );
    }

    await this.insertQuestions(manager, categoryId, plan.insert);
  }

  private async insertQuestions(
    manager: EntityManager,
    categoryId: string,
    inserts: QuestionMutationPlan['insert'],
  ): Promise<void> {
    if (inserts.length === 0) return;
    const questions = manager.getRepository(InstituteCategoryQuestionEntity);
    await questions.save(
      inserts.map((question) =>
        questions.create({
          categoryId,
          text: question.text,
          type: question.type,
          required: question.required,
          options: question.options,
          sortOrder: question.sortOrder,
        }),
      ),
    );
  }
}
