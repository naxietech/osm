import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AcademicClass } from '@oses/types';

import { toAcademicClass } from './class-mapper';
import { reconcileTree, toInitialGroups } from './class-tree-reconciler';
import type {
  CreateClassRequestDto,
  UpdateClassRequestDto,
  UpdateClassStatusRequestDto,
} from './dto';
import {
  CLASS_REPOSITORY,
  ClassGroupNameAlreadyExistsError,
  type ClassGroupRecord,
  ClassNameAlreadyExistsError,
  type ClassPatch,
  type ClassRepository,
  DuplicateClassGroupIdError,
  MisplacedClassGroupError,
  type TreeMutationPlan,
  UnknownClassGroupError,
} from './ports';

const NOT_FOUND = 'Class not found';

/**
 * Classes — the Class → Group → Subgroup hierarchy the super admin authors, and the structure
 * student registration and exam creation will read once those modules exist.
 *
 * A class and its tree are one aggregate: they are read together, written together in one
 * transaction, and share one `version`. There is no per-node route, so a half-built tree is
 * never a state anyone can observe.
 *
 * Every route that reaches here is gated by `@RequirePermissions('levels.manage')`.
 */
@Injectable()
export class ClassesService {
  constructor(
    @Inject(CLASS_REPOSITORY)
    private readonly classes: ClassRepository,
  ) {}

  /**
   * Classes in progression order, each with its live tree.
   *
   * @param activeOnly `false` (the management screen) returns deactivated classes too, or one
   * could never be switched back on. `true` (pickers) omits them.
   */
  async list(activeOnly: boolean): Promise<AcademicClass[]> {
    const records = await this.classes.list({ activeOnly });
    return records.map(toAcademicClass);
  }

  async findById(id: string): Promise<AcademicClass> {
    const record = await this.classes.findById(id);
    if (!record) throw new NotFoundException(NOT_FOUND);
    return toAcademicClass(record);
  }

  async create(dto: CreateClassRequestDto, actorId: string): Promise<AcademicClass> {
    try {
      const created = await this.classes.create({
        name: dto.name,
        ordinal: dto.ordinal,
        description: dto.description ?? null,
        groups: toInitialGroups(dto.groups ?? []),
        actorId,
      });
      return toAcademicClass(created);
    } catch (err) {
      throw this.translate(err);
    }
  }

  /**
   * Update the class and its tree together, in one transaction.
   *
   * Omitting `groups` leaves the stored tree alone; sending it replaces the tree by
   * comparison, so every node that keeps its id keeps whatever already points at it.
   */
  async update(id: string, dto: UpdateClassRequestDto, actorId: string): Promise<AcademicClass> {
    const existing = await this.classes.findById(id);
    if (!existing) throw new NotFoundException(NOT_FOUND);

    // Reconciled against the tree as it stands now, then applied under `expectedVersion`. If
    // someone saves in the gap the version check fails and the whole plan is discarded — the
    // plan is never applied to a tree it was not built from.
    const plan =
      dto.groups === undefined ? null : this.planTreeChanges(existing.groups, dto.groups);

    const patch: ClassPatch = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.ordinal !== undefined) patch.ordinal = dto.ordinal;
    if (dto.description !== undefined) patch.description = dto.description;

    let outcome;
    try {
      outcome = await this.classes.applyUpdate({
        id,
        expectedVersion: dto.version,
        patch,
        plan,
        actorId,
      });
    } catch (err) {
      throw this.translate(err);
    }

    switch (outcome.outcome) {
      case 'not-found':
        throw new NotFoundException(NOT_FOUND);
      case 'version-conflict':
        throw new ConflictException(
          'This class was changed by someone else. Reload it and try again.',
        );
      case 'updated':
        return toAcademicClass(outcome.class);
    }
  }

  /**
   * Switch a class on or off. There is no delete route — for the class or for anything in its
   * tree — because a million student rows will carry these ids.
   */
  async setActive(
    id: string,
    dto: UpdateClassStatusRequestDto,
    actorId: string,
  ): Promise<AcademicClass> {
    const updated = await this.classes.setActive(id, dto.isActive, actorId);
    if (!updated) throw new NotFoundException(NOT_FOUND);
    return toAcademicClass(updated);
  }

  private planTreeChanges(
    existing: readonly ClassGroupRecord[],
    incoming: NonNullable<UpdateClassRequestDto['groups']>,
  ): TreeMutationPlan {
    try {
      return reconcileTree(existing, incoming);
    } catch (err) {
      throw this.translate(err);
    }
  }

  /** Domain errors carry the detail; this only chooses the HTTP status that fits each one. */
  private translate(err: unknown): unknown {
    if (err instanceof ClassNameAlreadyExistsError) return new ConflictException(err.message);
    if (err instanceof ClassGroupNameAlreadyExistsError) return new ConflictException(err.message);
    if (err instanceof UnknownClassGroupError) return new BadRequestException(err.message);
    if (err instanceof DuplicateClassGroupIdError) return new BadRequestException(err.message);
    if (err instanceof MisplacedClassGroupError) return new BadRequestException(err.message);
    return err;
  }
}
