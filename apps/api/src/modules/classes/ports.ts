/**
 * Repository ports for the classes module. The service depends on these interfaces only; the
 * TypeORM adapter that implements them lives in `persistence/typeorm/repositories/`, so the
 * data layer stays swappable and the domain owns the contract.
 *
 * A class and its group tree are **one aggregate**: they are read together, written together,
 * and versioned together. One repository covers both tables for that reason — splitting them
 * would put the transaction boundary in the wrong place.
 */

/**
 * One row of `class_groups`, flat. `parentId` null means a group, set means a subgroup of
 * that group. The mapper nests them for the API; keeping the record flat means the repository
 * reads the whole tree in one query and the nesting logic lives in exactly one place.
 *
 * Deactivated rows are included. The mapper withholds them from callers, but the reconciler
 * needs them: submitting a group by name alone reclaims the sibling already holding that name
 * — whether it was deactivated, or simply sent back without its id — rather than inserting a
 * second row the unique index would refuse.
 */
export interface ClassGroupRecord {
  id: string;
  parentId: string | null;
  name: string;
  /** Position among its siblings, 1-based. */
  sortOrder: number;
  isActive: boolean;
}

export interface ClassRecord {
  id: string;
  name: string;
  ordinal: number;
  description: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  groups: ClassGroupRecord[];
}

/**
 * A brand-new group, together with the brand-new subgroups that belong under it.
 *
 * Nested rather than flat because the subgroups need their parent's id, and the database does
 * not assign one until the group is inserted. A flat list of `{ parentId, name }` could not
 * express "under the group you are about to create".
 */
export interface NewGroup {
  name: string;
  sortOrder: number;
  /** Subgroup names in submitted order — their positions are their indexes. */
  subgroups: string[];
}

/** A new subgroup under a group that already has an id. */
export interface NewSubgroup {
  parentId: string;
  name: string;
  sortOrder: number;
}

/**
 * A row that survives the save and needs writing — because its name changed, it moved position
 * among its siblings, or it was switched back on. A survivor that changed in none of those ways
 * is not in this list at all, so an untouched tree is not rewritten on every save.
 */
export interface KeptNode {
  id: string;
  name: string;
  sortOrder: number;
}

/**
 * The difference between the tree a caller submitted and the rows already stored. Produced by
 * `reconcileTree`, applied by the repository inside the same transaction as the class update.
 */
export interface TreeMutationPlan {
  insertGroups: NewGroup[];
  insertSubgroups: NewSubgroup[];
  keep: KeptNode[];
  /**
   * Rows the payload did not mention. Switched off, **never deleted** — a million student rows
   * will carry these ids. Deactivating a group deactivates its subgroups with it, so the tree
   * can never hold an active subgroup under a deactivated group.
   */
  deactivate: string[];
}

export interface CreateClassInput {
  name: string;
  ordinal: number;
  description: string | null;
  /** The initial tree. Only inserts are possible on a class that does not exist yet. */
  groups: NewGroup[];
  actorId: string | null;
}

export interface ClassPatch {
  name?: string;
  ordinal?: number;
  description?: string | null;
}

export interface ApplyClassUpdateInput {
  id: string;
  /** The version the caller loaded. The update applies only while it still matches. */
  expectedVersion: number;
  patch: ClassPatch;
  /** `null` when the caller omitted `groups` entirely — the stored tree is left alone. */
  plan: TreeMutationPlan | null;
  actorId: string | null;
}

/**
 * Thrown when the `classes.name` unique constraint fires — including the race where two
 * concurrent creates both pass a pre-check. Translated to a 409 so a duplicate never surfaces
 * as a 500.
 */
export class ClassNameAlreadyExistsError extends Error {
  constructor(public readonly className: string) {
    super(`A class named "${className}" already exists`);
    this.name = 'ClassNameAlreadyExistsError';
  }
}

/**
 * A sibling name collided inside the tree. Zod already rejects duplicate siblings in one
 * payload, so this is the database catching what validation cannot see: two admins adding the
 * same group name at the same moment.
 */
export class ClassGroupNameAlreadyExistsError extends Error {
  constructor(public readonly name: string) {
    super(`"${name}" is already used by another group or subgroup in the same place`);
    this.name = 'ClassGroupNameAlreadyExistsError';
  }
}

/** A submitted group/subgroup id does not belong to the class being written. */
export class UnknownClassGroupError extends Error {
  constructor(public readonly nodeId: string) {
    super(`Group ${nodeId} does not belong to this class`);
    this.name = 'UnknownClassGroupError';
  }
}

/** The same group/subgroup id appears more than once in one submission. */
export class DuplicateClassGroupIdError extends Error {
  constructor(public readonly nodeId: string) {
    super(`Group ${nodeId} appears more than once`);
    this.name = 'DuplicateClassGroupIdError';
  }
}

/**
 * A submitted id exists in this class but not where the payload put it — a group sent as a
 * subgroup, a subgroup sent as a top-level group, or a subgroup moved under a different group.
 *
 * This is the rule SQL cannot hold. A CHECK constraint cannot look at another row, so
 * "a subgroup must not have subgroups of its own" is enforced here: a nested entry whose id
 * belongs to a row that is itself already a subgroup would create a third depth, and is
 * refused. Moving a node between parents is refused too — nothing in the product asks for it,
 * and permitting it would silently re-home whatever already points at that id.
 */
export class MisplacedClassGroupError extends Error {
  constructor(
    public readonly nodeId: string,
    reason: string,
  ) {
    super(`Group ${nodeId} cannot be saved there: ${reason}`);
    this.name = 'MisplacedClassGroupError';
  }
}

/**
 * Why an update did or did not apply. A discriminated union rather than a nullable record
 * because the two failure causes map to *different* HTTP answers — a caller that cannot tell
 * them apart would report "someone else edited this, reload" for a class that was deleted.
 */
export type ApplyClassUpdateOutcome =
  | { outcome: 'updated'; class: ClassRecord }
  | { outcome: 'not-found' }
  | { outcome: 'version-conflict' };

export const CLASS_REPOSITORY = 'CLASS_REPOSITORY';

export interface ClassRepository {
  /**
   * Classes with their full group tree, ordered by `ordinal` then name, in ONE query.
   * `activeOnly` filters the classes; group rows always come back complete, because the
   * reconciler needs the deactivated ones and the mapper is what withholds them from callers.
   */
  list(opts: { activeOnly: boolean }): Promise<ClassRecord[]>;
  findById(id: string): Promise<ClassRecord | null>;
  /** Insert a class and its initial tree atomically. Throws {@link ClassNameAlreadyExistsError}. */
  create(input: CreateClassInput): Promise<ClassRecord>;
  /**
   * Apply the class patch and the whole tree plan in ONE transaction, guarded by
   * `expectedVersion`.
   *
   * - `updated` — everything was written.
   * - `version-conflict` — someone else saved first (→ 409). **Nothing** was written; the
   *   tree plan is rolled back with the class row.
   * - `not-found` — no such class (→ 404).
   */
  applyUpdate(input: ApplyClassUpdateInput): Promise<ApplyClassUpdateOutcome>;
  /** Switch a class on or off. Bumps the version, so in-flight editors are not silently overwritten. */
  setActive(id: string, isActive: boolean, actorId: string | null): Promise<ClassRecord | null>;
}
