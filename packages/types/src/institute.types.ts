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
  PRIVATE = 'private',
  FEDERAL = 'federal',
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

export interface Institute {
  id: string;
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
  onboardingStatus: OnboardingStatus;
  isActive: boolean;
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
  | 'select'; // dropdown — pick one of `options`

/** Whether a question type carries a fixed list of answer options. */
export function questionTypeHasOptions(type: CategoryQuestionType): boolean {
  return type === 'radio' || type === 'checkbox' || type === 'select';
}

/**
 * A question attached to an institute category. When an institute registers under a
 * category, it answers this category's questions (e.g. "Are you ed-tech?"). Each question
 * has an answer `type`; choice types (radio/checkbox/select) carry their `options`.
 */
export interface InstituteCategoryQuestion {
  id: string;
  text: string;
  type: CategoryQuestionType;
  options: string[]; // answer choices for radio/checkbox/select; empty for text
}

/** Question payload when creating/editing a category; the service assigns ids. */
export interface CategoryQuestionInput {
  text: string;
  type: CategoryQuestionType;
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

export interface UpdateInstituteCategoryDto {
  code?: string;
  name?: string;
  description?: string;
  /** Full replacement list of questions; the service re-assigns ids. */
  questions?: CategoryQuestionInput[];
  isActive?: boolean;
}
