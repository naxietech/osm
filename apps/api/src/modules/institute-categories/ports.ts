import type { CategoryQuestionType } from '@oses/types';

/**
 * Repository ports for the institute-category module. The service depends on these interfaces
 * only; the TypeORM adapters that implement them live in `persistence/typeorm/repositories/`,
 * so the data layer stays swappable and the domain owns the contract.
 */

export interface CategoryQuestionRecord {
  id: string;
  text: string;
  type: CategoryQuestionType;
  required: boolean;
  options: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface InstituteCategoryRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  questions: CategoryQuestionRecord[];
}

/** A question to create. No id — the database assigns one that then never changes. */
export interface QuestionInsert {
  text: string;
  type: CategoryQuestionType;
  required: boolean;
  options: string[];
  sortOrder: number;
}

/** A question to update in place. `id` identifies the existing row and is never rewritten. */
export interface QuestionUpdate extends QuestionInsert {
  id: string;
  isActive: boolean;
}

/**
 * The difference between the question list a caller submitted and the rows already stored.
 * Produced by `reconcileQuestions`, applied by the repository inside the same transaction as
 * the category update.
 */
export interface QuestionMutationPlan {
  insert: QuestionInsert[];
  update: QuestionUpdate[];
  /** Retired because answers already reference them — hidden from forms, rows retained. */
  deactivate: string[];
  /** Safe to delete outright: nothing references them. */
  remove: string[];
}

export interface CreateInstituteCategoryInput {
  code: string;
  name: string;
  description: string | null;
  questions: QuestionInsert[];
  actorId: string | null;
}

export interface CategoryPatch {
  code?: string;
  name?: string;
  description?: string | null;
}

export interface ApplyUpdateInput {
  id: string;
  /** The version the caller loaded. The update applies only while it still matches. */
  expectedVersion: number;
  patch: CategoryPatch;
  plan: QuestionMutationPlan;
  actorId: string | null;
}

/**
 * Thrown when the `code` unique constraint fires — including the race where two concurrent
 * creates both pass a pre-check. The service translates it into a 409 so a duplicate never
 * surfaces as a 500.
 */
export class CategoryCodeAlreadyExistsError extends Error {
  constructor(public readonly code: string) {
    super(`A category with code "${code}" already exists`);
    this.name = 'CategoryCodeAlreadyExistsError';
  }
}

/**
 * The database refused to delete a category because something still references it.
 *
 * The service checks {@link CategoryReferenceProbe.isCategoryInUse} first, which gives a better
 * message — but a reference can be created in the gap between that check and the delete. This is
 * the database closing that race, so a concurrent registration can never strand an institute's
 * classification.
 */
export class CategoryInUseError extends Error {
  constructor(public readonly categoryId: string) {
    super(`Institute category ${categoryId} is still referenced`);
    this.name = 'CategoryInUseError';
  }
}

/** A submitted question id does not belong to the category being updated. */
export class UnknownQuestionError extends Error {
  constructor(public readonly questionId: string) {
    super(`Question ${questionId} does not belong to this category`);
    this.name = 'UnknownQuestionError';
  }
}

/** The same question id appears more than once in one submission. */
export class DuplicateQuestionIdError extends Error {
  constructor(public readonly questionId: string) {
    super(`Question ${questionId} appears more than once`);
    this.name = 'DuplicateQuestionIdError';
  }
}

/**
 * A change that would invalidate answers already stored against a question — changing its type,
 * or withdrawing an option institutes could already have chosen.
 *
 * The message names the question by its **text**, not its id. This one reaches a person: it is
 * shown verbatim on the categories screen, where an editor looking at a list of questions they
 * wrote has no way to turn `c08014fc-…` back into one of them. The id stays on the error as a
 * property for logs and tests, where it is the useful handle.
 */
export class AnsweredQuestionChangeError extends Error {
  constructor(
    public readonly questionId: string,
    questionText: string,
    reason: string,
  ) {
    super(`The question "${questionText}" already has answers, so ${reason}.`);
    this.name = 'AnsweredQuestionChangeError';
  }
}

/**
 * Why an update did or did not apply. A discriminated union rather than a nullable record
 * because the two failure causes map to *different* HTTP answers — a caller that cannot tell
 * them apart would report "someone else edited this, reload" for a category that was actually
 * deleted. Making the distinction part of the type means it cannot be overlooked.
 */
export type ApplyUpdateOutcome =
  | { outcome: 'updated'; category: InstituteCategoryRecord }
  | { outcome: 'not-found' }
  | { outcome: 'version-conflict' };

export const INSTITUTE_CATEGORY_REPOSITORY = 'INSTITUTE_CATEGORY_REPOSITORY';
export interface InstituteCategoryRepository {
  /**
   * Categories with their questions, ordered by code then `sortOrder`, in ONE query.
   * `activeOnly` filters both levels in the query itself — never afterwards in memory.
   */
  list(opts: { activeOnly: boolean }): Promise<InstituteCategoryRecord[]>;
  findById(id: string): Promise<InstituteCategoryRecord | null>;
  /** Insert a category and its questions atomically. Throws {@link CategoryCodeAlreadyExistsError}. */
  create(input: CreateInstituteCategoryInput): Promise<InstituteCategoryRecord>;
  /**
   * Apply the category patch and the whole question plan in ONE transaction, guarded by
   * `expectedVersion`.
   *
   * - `updated` — everything was written.
   * - `version-conflict` — someone else saved first (→ 409). **Nothing** was written; the
   *   question plan is rolled back with the category row.
   * - `not-found` — no such category (→ 404).
   */
  applyUpdate(input: ApplyUpdateInput): Promise<ApplyUpdateOutcome>;
  /** Switch a category on or off. Bumps the version, so in-flight editors are not silently overwritten. */
  setActive(
    id: string,
    isActive: boolean,
    actorId: string | null,
  ): Promise<InstituteCategoryRecord | null>;
  /** Hard delete (questions cascade). Returns whether a row was removed. */
  remove(id: string): Promise<boolean>;
}

export const CATEGORY_REFERENCE_PROBE = 'CATEGORY_REFERENCE_PROBE';
/**
 * Whether anything outside this module points at a category or its questions. Institute
 * registration (Module 2) has not been built, so the shipped implementation answers "nothing
 * references it" — the rules that depend on it are written, tested, and simply permissive until
 * the real implementation replaces this one method.
 */
export interface CategoryReferenceProbe {
  /**
   * The subset of the given ids that already have institute answers. Deliberately batched:
   * a per-question call would become an N+1 the moment the real implementation lands.
   */
  questionsWithAnswers(questionIds: readonly string[]): Promise<ReadonlySet<string>>;
  /** Whether any institute currently uses this category — blocks a hard delete. */
  isCategoryInUse(categoryId: string): Promise<boolean>;
}
