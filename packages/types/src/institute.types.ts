/**
 * The lifecycle an institute moves through.
 *
 * `rejected` is a dead end off `pending` — the application was never accepted, so nothing hangs
 * off it and its institute code is freed for a fresh attempt. `deactivated` is the opposite end:
 * the institute worked, has students and results behind it, and has been switched off reversibly.
 *
 * A runtime array rather than an enum so the API's Zod schema and the web's badges are built from
 * the same values — two independent declarations of one vocabulary drift, and did.
 */
export const INSTITUTE_STATUSES = ['pending', 'approved', 'rejected', 'deactivated'] as const;
export type InstituteStatus = (typeof INSTITUTE_STATUSES)[number];

/** How the record arrived: the open registration link, or entered by staff. */
export const REGISTRATION_SOURCES = ['public', 'admin'] as const;
export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];

/**
 * Education level, mapped to Pakistani board stages.
 *
 * No longer a field on `Institute` — the TRD's Module 2 field list does not ask for it. The enum
 * stays because `exam.types.ts` uses it, so removing it would break the exam model for a change
 * that was only ever about institutes.
 */
export enum InstituteLevel {
  SECONDARY = 'secondary', // SSC / Matric (Classes 9–10)
  HIGHER_SECONDARY = 'higher_secondary', // HSSC / Intermediate (Classes 11–12)
  BOTH = 'both',
}

/** Ownership / sector of the institute. */
export enum InstitutionType {
  GOVERNMENT = 'government',
  SEMI_GOVERNMENT = 'semi_government',
  PRIVATE = 'private',
  OTHER = 'other',
}

/** Pakistani provinces and administrative regions. */
export enum Province {
  PUNJAB = 'punjab',
  SINDH = 'sindh',
  KPK = 'kpk', // Khyber Pakhtunkhwa
  BALOCHISTAN = 'balochistan',
  ICT = 'ict', // Islamabad Capital Territory
  AJK = 'ajk', // Azad Jammu & Kashmir
  GB = 'gb', // Gilgit-Baltistan
}

/**
 * An institute's answer to one of its category's questions.
 *
 * `values` is an array because the question type decides the shape: `text` stores one element,
 * `radio` and `select` the single option chosen, `checkbox` several. One column means a reader
 * never has to know which type it is asking about.
 */
export interface InstituteQuestionAnswer {
  questionId: string;
  values: string[];
}

/**
 * An institute, as the API returns it.
 *
 * Two codes, doing different jobs. `instituteCode` is the government's own (`S01`) — theirs, not
 * ours, and the thing a human recognises. `numericCode` is assigned by OSES at approval and is
 * what student registration numbers and roll-number blocks are built from; it is null until then.
 */
export interface Institute {
  id: string;
  instituteCode: string;
  numericCode: number | null;
  instituteName: string;
  branch: string | null; // campus, e.g. "Shakargarh Campus"
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
  /** Captured when an application is turned away, so the institute can be told what to fix. */
  rejectionReason: string | null;
  registrationSource: RegistrationSource;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  answers: InstituteQuestionAnswer[];
}

/** A live institute sharing this one's name and city — a prompt to look twice, never a block. */
export interface DuplicateWarning {
  id: string;
  instituteName: string;
  branch: string | null;
  city: string;
  status: InstituteStatus;
}

/** `GET /institutes/:id` — the record plus the warning the approval screen needs. */
export interface InstituteDetail extends Institute {
  possibleDuplicates: DuplicateWarning[];
}

/** `GET /institutes` */
export interface PaginatedInstitutes {
  items: Institute[];
  total: number;
}

/** The fields both entry paths supply. What differs between them is status, not shape. */
export interface InstituteDetailsDto {
  instituteCode: string;
  instituteName: string;
  branch?: string;
  categoryId: string;
  institutionType: InstitutionType;
  address: string;
  city: string;
  province: Province;
  postalCode?: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
  answers?: InstituteQuestionAnswer[];
}

/**
 * `POST /public/institutes` — the open link.
 *
 * The password is collected here because there is no email service to send a temporary one with.
 * It is hashed on arrival and held apart from the institute record until approval turns it into
 * a login.
 */
export interface RegisterInstituteDto extends InstituteDetailsDto {
  password: string;
}

/** `POST /institutes` — a super admin entering one directly. It lands approved. */
export type CreateInstituteDto = InstituteDetailsDto;

/**
 * `PATCH /institutes/:id`.
 *
 * The locked fields — `instituteCode`, `categoryId`, `answers`, `numericCode`, `status` — are
 * absent by design. The API rejects them by name rather than accepting the request and ignoring
 * them, because a caller who cannot tell "ignored" from "saved" will believe the change applied.
 *
 * `contactEmail` stays editable: contact people change jobs, and freezing the address means
 * nobody can reach the institute. Changing it does **not** change any login — that is a user
 * record, managed on the Users screen.
 */
export interface UpdateInstituteDto {
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

/** `POST /institutes/:id/approve` — Approve & Register. */
export interface ApproveInstituteDto {
  createLogin: boolean;
  fullName?: string;
  /** Only needed when no password is on file, i.e. an institute entered by an admin. */
  password?: string;
}

/** `POST /institutes/:id/reject` */
export interface RejectInstituteDto {
  reason: string;
}

/** `PATCH /institutes/:id/status` — `rejected` is reachable only from `pending`, via its own route. */
export interface UpdateInstituteStatusDto {
  status: Extract<InstituteStatus, 'approved' | 'deactivated'>;
}

/** `POST /public/institutes/check-availability` — a field not asked about answers `null`. */
export interface AvailabilityResult {
  codeAvailable: boolean | null;
  emailAvailable: boolean | null;
}

/** What the open registration link is told back. Four fields, and that is the whole contract. */
export interface RegistrationReceipt {
  id: string;
  instituteCode: string;
  instituteName: string;
  status: 'pending';
}

/** How an institute answers a category question. */
export type CategoryQuestionType =
  | 'text' // free-text answer
  | 'radio' // pick exactly one of `options`
  | 'checkbox' // pick any number of `options`
  | 'select' // dropdown — pick one of `options`
  | 'file'; // upload a document

/** Whether a question type carries a fixed list of answer options. */
export function questionTypeHasOptions(type: CategoryQuestionType): boolean {
  return type === 'radio' || type === 'checkbox' || type === 'select';
}

/**
 * A question attached to an institute category. When an institute registers under a category, it
 * answers this category's questions (e.g. "Are you ed-tech?"). Each question has an answer
 * `type`; choice types (radio/checkbox/select) carry their `options`. A `required` question must
 * be answered before the registration form can be submitted.
 */
export interface InstituteCategoryQuestion {
  id: string;
  text: string;
  type: CategoryQuestionType;
  required: boolean; // answer mandatory on the public registration form
  options: string[]; // answer choices for radio/checkbox/select; empty for text/file
}

/**
 * Question payload when creating/editing a category. An `id` marks an **existing** question to
 * update — its id is preserved, never regenerated, so answers already stored against it stay
 * valid. Omitting `id` creates a new question. Omitting a stored question from the list removes
 * it (retired if it already has answers, deleted otherwise).
 */
export interface CategoryQuestionInput {
  id?: string;
  text: string;
  type: CategoryQuestionType;
  required?: boolean;
  options?: string[];
}

/**
 * Super-admin-managed classification of institutes — e.g. School, College, Board, University,
 * Academy, PECTA. Each category can carry dynamic questions that institutes registering under it
 * must answer. Distinct from `institutionType` (ownership: govt/private).
 */
export interface InstituteCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  questions: InstituteCategoryQuestion[];
  isActive: boolean;
  /**
   * Optimistic-lock counter. A writer submits the version it loaded, and the update applies only
   * while it still matches — so a second concurrent save is rejected rather than silently
   * overwriting the first.
   */
  version: number;
}

export interface CreateInstituteCategoryDto {
  code: string;
  name: string;
  description?: string;
  questions?: CategoryQuestionInput[];
}

/**
 * `version` is mandatory: it is the copy the caller loaded. Omitting `questions` leaves the
 * stored list untouched — sending an empty array is what clears it. `isActive` is deliberately
 * absent; switching a category on or off has its own route, so it cannot ride along with an edit.
 */
export interface UpdateInstituteCategoryDto {
  version: number;
  code?: string;
  name?: string;
  description?: string | null;
  questions?: CategoryQuestionInput[];
}
