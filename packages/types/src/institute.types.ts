export enum OnboardingStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  SUSPENDED = 'suspended',
}

/** Education level the institute offers, mapped to Pakistani board stages. */
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

/** Gender composition of the institute (boys / girls / co-education). */
export enum GenderCategory {
  BOYS = 'boys',
  GIRLS = 'girls',
  CO_EDUCATION = 'co_education',
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

/** An institute's answer to one of its category's questions. */
export interface InstituteQuestionAnswer {
  questionId: string;
  values: string[]; // chosen option(s) or the free-text answer as a single-element array
}

export interface Institute {
  id: string;
  instituteCode: string; // govt-provided code, e.g. "S01"
  instituteName: string;
  branch?: string; // campus / branch, e.g. "Shakargarh Campus"
  registrationNo: string;
  categoryId: string; // InstituteCategory link (School / College / Academy / …)
  questionAnswers: InstituteQuestionAnswer[]; // answers to the category's questions
  institutionType: InstitutionType;
  instituteLevel: InstituteLevel;
  category: GenderCategory;
  address: string;
  city: string;
  province: Province;
  postalCode?: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
  onboardingStatus: OnboardingStatus;
  isActive: boolean;
  /** Reason captured by the super admin when a registration is rejected. */
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Used in list views — omits heavy/unused fields
export interface InstituteListItem {
  id: string;
  instituteCode: string;
  instituteName: string;
  city: string;
  onboardingStatus: OnboardingStatus;
  isActive: boolean;
}

export interface CreateInstituteDto {
  instituteCode: string;
  instituteName: string;
  registrationNo: string;
  institutionType: InstitutionType;
  instituteLevel: InstituteLevel;
  category: GenderCategory;
  address: string;
  city: string;
  province: Province;
  postalCode?: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
}

/**
 * Public self-registration payload (open link). Creates a PENDING institute the super
 * admin then approves. Carries the branch, govt code, chosen category + its question
 * answers, ownership type, address block and contact details.
 */
export interface RegisterInstituteDto {
  instituteName: string;
  branch?: string;
  instituteCode: string;
  categoryId: string;
  questionAnswers: InstituteQuestionAnswer[];
  institutionType: InstitutionType;
  instituteLevel: InstituteLevel;
  category: GenderCategory;
  address: string;
  province: Province;
  city: string;
  postalCode?: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
}

export interface UpdateInstituteDto {
  instituteName?: string;
  registrationNo?: string;
  institutionType?: InstitutionType;
  instituteLevel?: InstituteLevel;
  category?: GenderCategory;
  address?: string;
  city?: string;
  province?: Province;
  postalCode?: string;
  contactPersonName?: string;
  contactPersonDesignation?: string;
  contactEmail?: string;
  contactPhone?: string;
  onboardingStatus?: OnboardingStatus;
  isActive?: boolean;
}

/** How an institute answers a category question. */
export type CategoryQuestionType =
  | 'text' // free-text answer
  | 'radio' // pick exactly one of `options`
  | 'checkbox' // pick any number of `options`
  | 'select' // dropdown — pick one of `options`
  | 'file'; // upload a document (mock captures the file name only)

/** Whether a question type carries a fixed list of answer options. */
export function questionTypeHasOptions(type: CategoryQuestionType): boolean {
  return type === 'radio' || type === 'checkbox' || type === 'select';
}

/**
 * A question attached to an institute category. When an institute registers under a
 * category, it answers this category's questions (e.g. "Are you ed-tech?"). Each question
 * has an answer `type`; choice types (radio/checkbox/select) carry their `options`. A
 * `required` question must be answered before the registration form can be submitted.
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
 * Super-admin-managed classification of institutes — e.g. School, College, Board,
 * University, Academy, PECTA. Each category can carry dynamic yes/no `questions` that
 * institutes registering under it must answer. Distinct from `institutionType`
 * (ownership: govt/private) and `InstitutionKind` (school/college/university).
 */
export interface InstituteCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  questions: InstituteCategoryQuestion[];
  isActive: boolean;
}

export interface CreateInstituteCategoryDto {
  code: string;
  name: string;
  description?: string;
  questions?: CategoryQuestionInput[];
}

/**
 * NOTE — this is the mock/pre-versioning shape, not the live API contract. The backend's update
 * endpoint additionally requires a `version` (optimistic lock), accepts `description: null` to
 * clear it, and moves `isActive` to its own `PATCH /institute-categories/:id/status` route.
 * Reconcile this type with that contract when the web app is wired to the real API.
 */
export interface UpdateInstituteCategoryDto {
  code?: string;
  name?: string;
  description?: string;
  /** Full replacement list of questions; the service re-assigns ids. */
  questions?: CategoryQuestionInput[];
  isActive?: boolean;
}
