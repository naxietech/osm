import type {
  CategoryQuestionType,
  InstituteStatus,
  InstitutionType,
  Province,
  RegistrationSource,
} from '@oses/types';

/**
 * Repository ports for the institutes module. The service depends on these interfaces only; the
 * TypeORM adapters live in `persistence/typeorm/repositories/`, so the data layer stays swappable
 * and the domain owns the contract.
 */

export interface InstituteAnswerRecord {
  questionId: string;
  values: string[];
}

export interface InstituteRecord {
  id: string;
  instituteCode: string;
  numericCode: number | null;
  instituteName: string;
  branch: string | null;
  categoryId: string;
  institutionType: InstitutionType;
  address: string;
  city: string;
  province: Province;
  postalCode: string | null;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
  status: InstituteStatus;
  rejectionReason: string | null;
  registrationSource: RegistrationSource;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  answers: InstituteAnswerRecord[];
}

/** The fields both entry paths supply. What differs between them is status, not shape. */
export interface InstituteDetailsInput {
  instituteCode: string;
  instituteName: string;
  branch: string | null;
  categoryId: string;
  institutionType: InstitutionType;
  address: string;
  city: string;
  province: Province;
  postalCode: string | null;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
}

export interface CreateInstituteInput extends InstituteDetailsInput {
  answers: InstituteAnswerRecord[];
  /**
   * `pending` for a public self-registration, `approved` when a super admin enters one directly.
   * An approved row must arrive with its numeric code already drawn — a check constraint enforces
   * that, so the repository draws it inside the same transaction as the insert.
   */
  status: Extract<InstituteStatus, 'pending' | 'approved'>;
  registrationSource: RegistrationSource;
  /** argon2id. Stored in its own table, never on the institute row. Null for the admin path. */
  passwordHash: string | null;
  actorId: string | null;
}

/** Only the keys present are written. Locked fields are rejected by the service, not here. */
export interface InstitutePatch {
  instituteName?: string;
  branch?: string | null;
  institutionType?: InstitutionType;
  address?: string;
  city?: string;
  province?: Province;
  postalCode?: string | null;
  contactPersonName?: string;
  contactPersonDesignation?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface ListInstitutesFilters {
  search?: string | undefined;
  status?: InstituteStatus | undefined;
  categoryId?: string | undefined;
}

export interface ListInstitutesQuery extends ListInstitutesFilters {
  limit: number;
  offset: number;
}

/** A possible duplicate surfaced for a human to judge — never a block. */
export interface DuplicateCandidate {
  id: string;
  instituteName: string;
  branch: string | null;
  city: string;
  status: InstituteStatus;
}

/**
 * What is attached to an institute, and therefore whether it may be deleted. Counted rather than
 * a bare boolean so the refusal can say *what* is attached instead of "something is".
 */
export interface InstituteDependantCounts {
  users: number;
  students: number;
  exams: number;
}

/**
 * The live-uniqueness index fired. Includes the race where two concurrent registrations both pass
 * the service's pre-check; the service turns it into a 409 so a duplicate never becomes a 500.
 */
export class InstituteCodeAlreadyExistsError extends Error {
  constructor(public readonly instituteCode: string) {
    super(`An institute with code "${instituteCode}" already exists`);
    this.name = 'InstituteCodeAlreadyExistsError';
  }
}

/**
 * The contact-address uniqueness index fired — same race as the code, different field. Separate
 * from {@link InstituteCodeAlreadyExistsError} so the applicant is told which field to change;
 * one shared error would name whichever the handler guessed.
 */
export class InstituteContactEmailAlreadyExistsError extends Error {
  constructor(public readonly contactEmail: string) {
    super(`An institute with contact email "${contactEmail}" already exists`);
    this.name = 'InstituteContactEmailAlreadyExistsError';
  }
}

/** A submitted answer points at a question that is not in the chosen category. */
export class UnknownQuestionError extends Error {
  constructor(public readonly questionId: string) {
    super(`Question ${questionId} does not belong to the chosen category`);
    this.name = 'UnknownQuestionError';
  }
}

export const INSTITUTE_REPOSITORY = 'INSTITUTE_REPOSITORY';
export interface InstituteRepository {
  /** A page of institutes, newest first, narrowed by the same filters as {@link count}. */
  list(query: ListInstitutesQuery): Promise<InstituteRecord[]>;
  count(filters: ListInstitutesFilters): Promise<number>;
  findById(id: string): Promise<InstituteRecord | null>;
  /**
   * Whether a code is free to register. Matches the partial unique index exactly — rejected and
   * soft-deleted rows do not hold a code, which is what lets a turned-away institute re-apply.
   */
  isCodeTaken(instituteCode: string): Promise<boolean>;
  /**
   * Whether a contact email is already an institute's, on the same terms as {@link isCodeTaken}
   * — a rejected or deleted institute releases its address so the applicant can try again.
   *
   * Separate from {@link AccountLookup.isEmailTaken}, which asks about *accounts*. An address can
   * be free of any account and still be spoken for: the institute holding it has not been
   * approved yet, so no user exists, and approving them both would leave the second one approved
   * with no possible login.
   *
   * @param excludeInstituteId ignore this institute — an edit keeping its own address is not a
   *   clash with itself.
   */
  isContactEmailTaken(contactEmail: string, excludeInstituteId?: string): Promise<boolean>;
  /**
   * Insert the institute, its answers and (for the public path) its credential in ONE
   * transaction, drawing the numeric code from the sequence when the row arrives approved.
   * Throws {@link InstituteCodeAlreadyExistsError}.
   */
  create(input: CreateInstituteInput): Promise<InstituteRecord>;
  /** Returns null when no live row has that id. */
  update(
    id: string,
    patch: InstitutePatch,
    actorId: string | null,
    /**
     * When given, **replaces** the institute's whole answer set. `undefined` leaves the stored
     * answers untouched — which is not the same as `[]`, and the difference matters: a caller
     * changing only a phone number must not silently wipe what the institute declared.
     */
    answers?: InstituteAnswerRecord[],
  ): Promise<InstituteRecord | null>;
  /** Soft delete, recording who did it. The service checks dependants first. */
  softDelete(id: string, actorId: string): Promise<boolean>;
  /** Live institutes whose name and city both match, for the approval screen's warning. */
  findDuplicateCandidates(
    instituteName: string,
    city: string,
    excludeId?: string,
  ): Promise<DuplicateCandidate[]>;
}

export const INSTITUTE_DEPENDANTS = 'INSTITUTE_DEPENDANTS';
/**
 * Everything outside this module that hangs off an institute.
 *
 * Only the **user** half is real today, because `users` is the only one of these tables that
 * exists. Students, exams and evaluator allocations are placeholders that count zero and do
 * nothing — the interface, its call order and its tests ship now so that when those modules land
 * the protection turns on by filling in a method, rather than by retrofitting cascade rules onto
 * a table already carrying a million rows.
 *
 * `deactivate` is ordered deliberately: allocations are released *before* their evaluator is
 * switched off, or the work would be stranded on an account that can no longer act on it.
 */
export interface InstituteDependants {
  count(instituteId: string): Promise<InstituteDependantCounts>;
  /** Switch off every account belonging to this institute and revoke their sessions. */
  deactivateUsers(instituteId: string, reason: string): Promise<number>;
  /** Placeholder until the marking module exists. Must run before {@link deactivateEvaluators}. */
  releaseAllocations(instituteId: string): Promise<number>;
  /** Placeholder until the checker module exists. */
  deactivateEvaluators(instituteId: string): Promise<number>;
  /** Placeholder until the student module exists. Will need batching — see the plan, §07. */
  deactivateStudents(instituteId: string): Promise<number>;
}

/** The login to create alongside the approval, or null when the admin declined to make one. */
export interface ApprovalLogin {
  email: string;
  fullName: string;
  passwordHash: string;
  roleId: string;
}

export interface ApproveInstituteInput {
  instituteId: string;
  approvedBy: string;
  login: ApprovalLogin | null;
}

/**
 * Why an approval did or did not apply.
 *
 * A discriminated union rather than a nullable record, for the same reason the categories module
 * uses one: these map to *different* HTTP answers, and a caller that cannot tell them apart would
 * report "already approved" for an institute that was actually deleted. Making the distinction
 * part of the type means it cannot be overlooked.
 */
export type ApproveOutcome =
  | { outcome: 'approved'; institute: InstituteRecord; userId: string | null }
  | { outcome: 'not-found' }
  | { outcome: 'not-pending' }
  | { outcome: 'email-taken' };

export interface RejectInstituteInput {
  instituteId: string;
  reason: string;
  rejectedBy: string;
}

export type RejectOutcome =
  | { outcome: 'rejected'; institute: InstituteRecord }
  | { outcome: 'not-found' }
  | { outcome: 'not-pending' };

export const INSTITUTE_APPROVAL_REPOSITORY = 'INSTITUTE_APPROVAL_REPOSITORY';
/**
 * The writes that must succeed or fail together.
 *
 * Separate from {@link InstituteRepository} because this is the only port that reaches across
 * institutes, stored credentials *and* accounts — and because every method here is a transaction
 * rather than a statement. Keeping them apart makes it obvious which operations have atomicity to
 * reason about.
 */
export interface InstituteApprovalRepository {
  /**
   * Approve and, optionally, create the login — in ONE transaction:
   *
   * 1. flip `pending` → `approved`, guarded by `where status = 'pending'` so a second concurrent
   *    approval affects no rows and reports `not-pending` instead of minting a second account
   * 2. draw the permanent numeric code from the sequence
   * 3. insert the user
   * 4. destroy the stored credential
   *
   * Any failure rolls back all four. Half-finishing produces the states that are hardest to
   * recover from: an approved institute nobody can sign in to, or an account belonging to an
   * institute still marked pending.
   */
  approve(input: ApproveInstituteInput): Promise<ApproveOutcome>;
  /** Move `pending` → `rejected` and destroy the stored credential, together. Frees the code. */
  reject(input: RejectInstituteInput): Promise<RejectOutcome>;
  /** Deactivate or reactivate. Returns null when no live institute has that id. */
  setStatus(
    instituteId: string,
    status: Extract<InstituteStatus, 'approved' | 'deactivated'>,
    actorId: string,
  ): Promise<InstituteRecord | null>;
}

export const CATEGORY_LOOKUP = 'CATEGORY_LOOKUP';

export interface CategoryQuestionSummary {
  id: string;
  text: string;
  type: CategoryQuestionType;
  required: boolean;
  options: string[];
  isActive: boolean;
}

export interface CategorySummary {
  id: string;
  isActive: boolean;
  questions: CategoryQuestionSummary[];
}

/**
 * The slice of a category this module needs to validate a registration.
 *
 * A narrow port of our own rather than importing the categories module's full repository
 * interface: this module needs to ask two questions, and declaring exactly those two means a
 * later change to how categories are stored cannot ripple in here.
 */
export interface CategoryLookup {
  findById(categoryId: string): Promise<CategorySummary | null>;
}

export const ACCOUNT_LOOKUP = 'ACCOUNT_LOOKUP';
/**
 * Whether an email already belongs to an account. Asked twice: once on the public availability
 * check so an applicant is told immediately, and again at approval, because weeks can pass in
 * between and the address may have been taken meanwhile.
 */
export interface AccountLookup {
  isEmailTaken(email: string): Promise<boolean>;
}

export const INSTITUTE_CREDENTIAL_REPOSITORY = 'INSTITUTE_CREDENTIAL_REPOSITORY';
/**
 * The password an institute chose on the public form, held until approval turns it into a user.
 *
 * A port of its own rather than a method on {@link InstituteRepository}, for the same reason the
 * table is separate: nothing that reads an institute should be able to reach a password hash. The
 * approval path is the only caller, and it both reads and destroys in one transaction.
 */
export interface InstituteCredentialRepository {
  find(instituteId: string): Promise<string | null>;
  remove(instituteId: string): Promise<void>;
}
