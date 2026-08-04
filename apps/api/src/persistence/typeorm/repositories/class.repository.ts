import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import {
  type ApplyClassUpdateInput,
  type ApplyClassUpdateOutcome,
  ClassGroupNameAlreadyExistsError,
  type ClassGroupRecord,
  ClassNameAlreadyExistsError,
  type ClassPatch,
  type ClassRecord,
  type ClassRepository,
  type CreateClassInput,
  type NewGroup,
  type TreeMutationPlan,
} from '../../../modules/classes/ports';
import { ClassEntity, ClassGroupEntity } from '../entities';
import { isUniqueViolation, uniqueViolationConstraint } from '../pg-errors';

/** The unique index behind each kind of duplicate-name failure. */
const CLASS_NAME_CONSTRAINT = 'classes_name_uq';

function toGroupRecord(group: ClassGroupEntity): ClassGroupRecord {
  return {
    id: group.id,
    parentId: group.parentId,
    name: group.name,
    sortOrder: group.sortOrder,
    isActive: group.isActive,
  };
}

function toRecord(cls: ClassEntity): ClassRecord {
  return {
    id: cls.id,
    name: cls.name,
    ordinal: cls.ordinal,
    description: cls.description,
    isActive: cls.isActive,
    version: cls.version,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
    groups: (cls.groups ?? []).map(toGroupRecord),
  };
}

/** Only the keys actually present are written, so an absent field is left untouched. */
function patchToSet(patch: ClassPatch): QueryDeepPartialEntity<ClassEntity> {
  const set: QueryDeepPartialEntity<ClassEntity> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.ordinal !== undefined) set.ordinal = patch.ordinal;
  if (patch.description !== undefined) set.description = patch.description;
  return set;
}

/**
 * One repository for both `classes` and `class_groups`, because a class and its tree are one
 * aggregate — read as a unit, written as a unit, versioned as a unit. Splitting them would put
 * the transaction boundary in the wrong place.
 */
@Injectable()
export class TypeOrmClassRepository implements ClassRepository {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly repo: Repository<ClassEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(opts: { activeOnly: boolean }): Promise<ClassRecord[]> {
    // One query, one join — never a query per class. Group rows come back in full, active and
    // deactivated alike: the mapper is what withholds the deactivated ones from callers, and the
    // reconciler needs them to revive a name that is re-added.
    const qb = this.repo
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.groups', 'group')
      // Progression order, not alphabetical — "Class 10" must not sort before "Class 9".
      // Name is the tie-break so two classes sharing an ordinal still come back stably.
      .orderBy('class.ordinal', 'ASC')
      .addOrderBy('LOWER("class"."name"::text)', 'ASC')
      // Display order within each parent. `id` is the tie-break so a tree written before
      // positions were assigned still comes back the same way twice.
      .addOrderBy('group.sortOrder', 'ASC')
      .addOrderBy('group.id', 'ASC');

    if (opts.activeOnly) qb.andWhere('class.isActive = true');

    const rows = await qb.getMany();
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<ClassRecord | null> {
    const row = await this.repo
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.groups', 'group')
      .where('class.id = :id', { id })
      .orderBy('group.sortOrder', 'ASC')
      .addOrderBy('group.id', 'ASC')
      .getOne();
    return row ? toRecord(row) : null;
  }

  async create(input: CreateClassInput): Promise<ClassRecord> {
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const classes = manager.getRepository(ClassEntity);
        const saved = await classes.save(
          classes.create({
            name: input.name,
            ordinal: input.ordinal,
            description: input.description,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }),
        );
        await this.insertGroups(manager, saved.id, input.groups);
        return saved.id;
      });

      // Re-read so DB-defaulted columns (version, timestamps, generated ids) come back exactly
      // as stored.
      const created = await this.findById(id);
      if (!created) throw new Error(`class ${id} vanished immediately after creation`);
      return created;
    } catch (err) {
      throw this.translateUniqueViolation(err, input.name);
    }
  }

  async applyUpdate(input: ApplyClassUpdateInput): Promise<ApplyClassUpdateOutcome> {
    try {
      const claimed = await this.dataSource.transaction(async (manager) => {
        // Conditional update: the row is only touched while it still carries the version the
        // caller loaded. A concurrent save has already bumped it, so this matches nothing and
        // the whole transaction — including every tree change — is abandoned. That is what
        // stops a stale tree save from deactivating a group somebody just added.
        const claim = await manager
          .createQueryBuilder()
          .update(ClassEntity)
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
          if (input.plan) await this.applyPlan(manager, input.id, input.plan);
          return 'updated' as const;
        }

        // Zero rows matched for one of two reasons that mean very different things to the
        // caller. Resolve it inside the same transaction so the answer cannot itself be racy.
        const stillExists =
          (await manager.getRepository(ClassEntity).count({ where: { id: input.id } })) > 0;
        return stillExists ? ('version-conflict' as const) : ('not-found' as const);
      });

      if (claimed !== 'updated') return { outcome: claimed };

      const record = await this.findById(input.id);
      if (!record) throw new Error(`class ${input.id} vanished mid-update`);
      return { outcome: 'updated', class: record };
    } catch (err) {
      throw this.translateUniqueViolation(err, input.patch.name);
    }
  }

  async setActive(
    id: string,
    isActive: boolean,
    actorId: string | null,
  ): Promise<ClassRecord | null> {
    // Bumps the version too, so an editor holding a stale copy is told to reload rather than
    // silently overwriting the switch.
    const result = await this.repo
      .createQueryBuilder()
      .update(ClassEntity)
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

  /**
   * Apply the tree diff. **Order matters and is not incidental:** deactivations and renames run
   * before inserts, so a name freed by a rename is available to whatever claims it next. The
   * sibling unique indexes do not exclude deactivated rows and a unique index cannot be
   * deferred, so the alternative is a spurious duplicate-name failure on a perfectly valid
   * save.
   *
   * One case this ordering still cannot rescue is two siblings swapping names in a single
   * save: the first rename collides with the second row, which has not been renamed yet. That
   * surfaces as a generic duplicate-sibling-name 409 — the message does not name the offending
   * group, since the constraint gives us no way to tell which of the two it was. Survivable,
   * and rare enough not to be worth a two-phase rename through temporary values.
   */
  private async applyPlan(
    manager: EntityManager,
    classId: string,
    plan: TreeMutationPlan,
  ): Promise<void> {
    const groups = manager.getRepository(ClassGroupEntity);
    const now = new Date();

    // Every statement is scoped by `classId` as well as by id. The ids in a plan always
    // originate from this class, but the repository is the boundary that must hold even if a
    // future caller hands over a plan built somewhere else.
    //
    // Each write's row count is then checked against the plan. Today that can only ever match:
    // the plan is built from this class's own rows and applied inside the same transaction as
    // the version check, so nothing can have moved underneath it. But the scoping above is
    // precisely what would silently turn a foreign id into a zero-row no-op, and a dropped
    // rename answered with 200 is the worst way to find that out. Checking makes the invariant
    // enforced rather than merely true.
    if (plan.deactivate.length > 0) {
      const result = await groups.update(
        { id: In(plan.deactivate), classId },
        { isActive: false, updatedAt: now },
      );
      if (result.affected !== plan.deactivate.length) {
        throw new Error(
          `class ${classId}: expected to deactivate ${plan.deactivate.length} group rows, affected ${result.affected}`,
        );
      }
    }

    // Node counts are capped at 30 per level by validation, so per-row updates are cheaper
    // than building a bulk CASE statement and far easier to read.
    for (const node of plan.keep) {
      const result = await groups.update(
        { id: node.id, classId },
        { name: node.name, sortOrder: node.sortOrder, isActive: true, updatedAt: now },
      );
      if (result.affected !== 1) {
        throw new Error(
          `class ${classId}: expected to update group ${node.id}, affected ${result.affected}`,
        );
      }
    }

    await this.insertGroups(manager, classId, plan.insertGroups);

    if (plan.insertSubgroups.length > 0) {
      await groups.save(
        plan.insertSubgroups.map((subgroup) =>
          groups.create({
            classId,
            parentId: subgroup.parentId,
            name: subgroup.name,
            sortOrder: subgroup.sortOrder,
          }),
        ),
      );
    }
  }

  /**
   * Insert whole groups together with their subgroups. Two statements rather than two per
   * group: the parents go in as one batch, and their generated ids then key the children.
   */
  private async insertGroups(
    manager: EntityManager,
    classId: string,
    newGroups: readonly NewGroup[],
  ): Promise<void> {
    if (newGroups.length === 0) return;

    const groups = manager.getRepository(ClassGroupEntity);
    const savedParents = await groups.save(
      newGroups.map((group) =>
        groups.create({
          classId,
          parentId: null,
          name: group.name,
          sortOrder: group.sortOrder,
        }),
      ),
    );

    const children = newGroups.flatMap((group, index) => {
      const parent = savedParents[index];
      if (!parent) throw new Error(`group "${group.name}" was not returned after insert`);
      return group.subgroups.map((name, childIndex) =>
        groups.create({ classId, parentId: parent.id, name, sortOrder: childIndex + 1 }),
      );
    });

    if (children.length > 0) await groups.save(children);
  }

  /**
   * A 23505 from a class write can come from three different unique indexes, and they are
   * three different messages. The constraint name is the only thing that tells them apart.
   *
   * When the driver reports no constraint name the violation is genuinely unattributable, and
   * it stays a 500. It is tempting to guess "the class name is taken" whenever the payload
   * happened to carry a rename — but a single write touches `classes` and `class_groups`
   * together, so that guess sends the admin off renaming a class over a duplicate *group*
   * name, with the real cause never surfaced. An honest 500 with the original error logged is
   * more use than a confident 409 pointing at the wrong field.
   */
  private translateUniqueViolation(err: unknown, className: string | undefined): unknown {
    if (!isUniqueViolation(err)) return err;

    const constraint = uniqueViolationConstraint(err);
    if (constraint === CLASS_NAME_CONSTRAINT) {
      return new ClassNameAlreadyExistsError(className ?? 'that name');
    }
    if (constraint !== null) return new ClassGroupNameAlreadyExistsError('that name');
    return err;
  }
}
