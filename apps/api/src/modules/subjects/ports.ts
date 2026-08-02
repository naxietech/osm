/**
 * Repository port for the subjects module. The service depends on this interface only; the
 * TypeORM adapter that implements it lives in `persistence/typeorm/repositories/`, so the data
 * layer stays swappable and the domain owns the contract.
 */

export interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubjectInput {
  code: string;
  name: string;
  actorId: string | null;
}

/** Only the keys present are written; an absent field is left exactly as stored. */
export interface SubjectPatch {
  code?: string;
  name?: string;
}

/**
 * Thrown when the `code` unique constraint fires — including the race where two concurrent
 * creates both pass a pre-check. The service turns it into a 409 so a duplicate can never
 * surface as a 500.
 */
export class SubjectCodeAlreadyExistsError extends Error {
  constructor(public readonly code: string) {
    super(`A subject with code "${code}" already exists`);
    this.name = 'SubjectCodeAlreadyExistsError';
  }
}

export const SUBJECT_REPOSITORY = 'SUBJECT_REPOSITORY';

/**
 * Every method that targets one row answers `null` for "no such subject" rather than throwing,
 * so the service is the single place that decides what a missing row means to a caller (404).
 *
 * There is no `remove`: a subject is withdrawn with `setActive(id, false)`. Nothing referencing
 * it can be orphaned if the row never disappears — see the migration for the rest of that
 * reasoning.
 */
export interface SubjectRepository {
  /** Ordered by name, case-insensitively, with `code` as a stable tie-break. */
  list(opts: { activeOnly: boolean }): Promise<SubjectRecord[]>;
  findById(id: string): Promise<SubjectRecord | null>;
  /** Throws {@link SubjectCodeAlreadyExistsError} when the code is taken. */
  create(input: CreateSubjectInput): Promise<SubjectRecord>;
  /** Throws {@link SubjectCodeAlreadyExistsError} when the patch moves onto a taken code. */
  update(id: string, patch: SubjectPatch, actorId: string | null): Promise<SubjectRecord | null>;
  setActive(id: string, isActive: boolean, actorId: string | null): Promise<SubjectRecord | null>;
}
