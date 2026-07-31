/**
 * Mock institute service (frontend only) — the shared institute store. Backs the
 * super-admin institutes list, the public self-registration link, and the approval
 * queue. Public registrations land as PENDING + inactive; the super admin approves
 * (→ COMPLETE + active) or rejects (→ SUSPENDED + inactive).
 *
 * TODO: replace with a real institutesApi.
 */
import {
  GenderCategory,
  type Institute,
  InstituteLevel,
  type InstituteListItem,
  InstitutionType,
  OnboardingStatus,
  Province,
  type RegisterInstituteDto,
} from '@oses/types';

const SEED_AT = '2025-01-15T08:00:00.000Z';

export const institutes: Institute[] = [
  {
    id: 'sch_001',
    instituteCode: 'LHR-001',
    instituteName: 'Government High School Gulberg',
    registrationNo: 'FBISE-LHR-2019-001',
    categoryId: 'cat_school',
    questionAnswers: [],
    institutionType: InstitutionType.GOVERNMENT,
    instituteLevel: InstituteLevel.HIGHER_SECONDARY,
    category: GenderCategory.BOYS,
    address: '12 Main Boulevard, Gulberg III',
    city: 'Lahore',
    province: Province.PUNJAB,
    postalCode: '54660',
    contactPersonName: 'Ahmed Raza',
    contactPersonDesignation: 'Principal',
    contactEmail: 'principal@ghsg.edu.pk',
    contactPhone: '+92-42-35761234',
    onboardingStatus: OnboardingStatus.COMPLETE,
    isActive: true,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
  {
    id: 'sch_002',
    instituteCode: 'KHI-001',
    instituteName: 'Government Boys Secondary School Clifton',
    registrationNo: 'BISE-KHI-2018-014',
    categoryId: 'cat_school',
    questionAnswers: [],
    institutionType: InstitutionType.GOVERNMENT,
    instituteLevel: InstituteLevel.SECONDARY,
    category: GenderCategory.BOYS,
    address: 'Block 5, Clifton',
    city: 'Karachi',
    province: Province.SINDH,
    postalCode: '75600',
    contactPersonName: 'Sana Malik',
    contactPersonDesignation: 'Headmistress',
    contactEmail: 'head@gbsclifton.edu.pk',
    contactPhone: '+92-21-35870011',
    onboardingStatus: OnboardingStatus.IN_PROGRESS,
    isActive: true,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
  {
    id: 'sch_003',
    instituteCode: 'ISB-001',
    instituteName: 'Federal Government School F-8',
    registrationNo: 'FBISE-ISB-2020-007',
    categoryId: 'cat_school',
    questionAnswers: [],
    institutionType: InstitutionType.SEMI_GOVERNMENT,
    instituteLevel: InstituteLevel.HIGHER_SECONDARY,
    category: GenderCategory.CO_EDUCATION,
    address: 'Street 24, F-8/2',
    city: 'Islamabad',
    province: Province.ICT,
    postalCode: '44000',
    contactPersonName: 'Imran Qureshi',
    contactPersonDesignation: 'Principal',
    contactEmail: 'principal@fgsf8.edu.pk',
    contactPhone: '+92-51-2261100',
    onboardingStatus: OnboardingStatus.COMPLETE,
    isActive: true,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
];

function toListItem(i: Institute): InstituteListItem {
  return {
    id: i.id,
    instituteCode: i.instituteCode,
    instituteName: i.branch ? `${i.instituteName}, ${i.branch}` : i.instituteName,
    city: i.city,
    onboardingStatus: i.onboardingStatus,
    isActive: i.isActive,
  };
}

export function listInstitutes(): InstituteListItem[] {
  return institutes.map(toListItem);
}

export function getInstitute(id: string): Institute | undefined {
  return institutes.find((i) => i.id === id);
}

/** How many institutes are classified under a given category (guards category delete). */
export function countInstitutesInCategory(categoryId: string): number {
  return institutes.filter((i) => i.categoryId === categoryId).length;
}

/** Institutes awaiting the super admin's approval (public registrations). */
export function listPendingInstitutes(): Institute[] {
  return institutes.filter((i) => i.onboardingStatus === OnboardingStatus.PENDING);
}

/** How many registrations are awaiting approval (drives the sidebar badge). */
export function countPendingInstitutes(): number {
  return institutes.filter((i) => i.onboardingStatus === OnboardingStatus.PENDING).length;
}

/** Whether an institute code is already used — government codes must be unique. */
export function isInstituteCodeTaken(code: string): boolean {
  const normalized = code.trim().toLowerCase();
  return institutes.some((i) => i.instituteCode.trim().toLowerCase() === normalized);
}

let instituteCounter = institutes.length;

/** Public self-registration → a PENDING, inactive institute awaiting approval. */
export function registerInstitute(dto: RegisterInstituteDto): Institute {
  instituteCounter += 1;
  const now = new Date().toISOString();
  const institute: Institute = {
    id: `sch_new_${instituteCounter}`,
    instituteCode: dto.instituteCode,
    instituteName: dto.instituteName,
    registrationNo: '',
    categoryId: dto.categoryId,
    questionAnswers: dto.questionAnswers,
    institutionType: dto.institutionType,
    instituteLevel: dto.instituteLevel,
    category: dto.category,
    address: dto.address,
    city: dto.city,
    province: dto.province,
    contactPersonName: dto.contactPersonName,
    contactPersonDesignation: dto.contactPersonDesignation,
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
    onboardingStatus: OnboardingStatus.PENDING,
    isActive: false,
    createdAt: now,
    updatedAt: now,
    ...(dto.branch ? { branch: dto.branch } : {}),
    ...(dto.postalCode ? { postalCode: dto.postalCode } : {}),
  };
  institutes.push(institute);
  return institute;
}

/** Approve a pending institute → active + onboarding complete. */
export function approveInstitute(id: string): Institute | undefined {
  const institute = getInstitute(id);
  if (!institute) return undefined;
  institute.onboardingStatus = OnboardingStatus.COMPLETE;
  institute.isActive = true;
  institute.updatedAt = new Date().toISOString();
  return institute;
}

/** Reject a pending institute → suspended + inactive, recording an optional reason. */
export function rejectInstitute(id: string, reason?: string): Institute | undefined {
  const institute = getInstitute(id);
  if (!institute) return undefined;
  institute.onboardingStatus = OnboardingStatus.SUSPENDED;
  institute.isActive = false;
  if (reason && reason.trim().length > 0) institute.rejectionReason = reason.trim();
  institute.updatedAt = new Date().toISOString();
  return institute;
}

// ---- institute pickers (used by any screen that has to choose or name an institute) ----

/**
 * Institutes offered in a picker. Derived from the seed above rather than hand-listed, so
 * the two can't drift apart. Like the rest of this mock it is a module-level snapshot —
 * an institute registered during the session won't appear until reload, which is the same
 * behaviour these screens had before.
 */
export const INSTITUTE_OPTIONS: Array<{ value: string; label: string }> = institutes.map((i) => ({
  value: i.id,
  label: i.instituteName,
}));

/** An institute's display name, or an em dash when there is none to show. */
export function instituteName(id: string | undefined): string {
  return (id && institutes.find((i) => i.id === id)?.instituteName) || '—';
}
