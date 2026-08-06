/**
 * Mock institute service (frontend only) — the shared institute store. Backs the
 * super-admin institutes list, the public self-registration link, and the approval
 * queue. A public registration lands `pending`; the super admin approves it or rejects it
 * with a reason.
 *
 * Shapes match the live API exactly (`@oses/types`), so wiring this to `apiRequest` is a
 * change of data source rather than a change of contract.
 *
 * TODO: replace with a real institutesApi.
 */
import { type Institute, InstitutionType, Province, type RegisterInstituteDto } from '@oses/types';

const SEED_AT = '2025-01-15T08:00:00.000Z';

export const institutes: Institute[] = [
  {
    id: 'sch_001',
    instituteCode: 'LHR-001',
    instituteName: 'Government High School Gulberg',
    categoryId: 'cat_school',
    numericCode: null,
    branch: null,
    answers: [],
    institutionType: InstitutionType.GOVERNMENT,
    address: '12 Main Boulevard, Gulberg III',
    city: 'Lahore',
    province: Province.PUNJAB,
    postalCode: '54660',
    contactPersonName: 'Ahmed Raza',
    contactPersonDesignation: 'Principal',
    contactEmail: 'principal@ghsg.edu.pk',
    contactPhone: '+92-42-35761234',
    status: 'approved',
    rejectionReason: null,
    registrationSource: 'admin',
    approvedAt: SEED_AT,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
  {
    id: 'sch_002',
    instituteCode: 'KHI-001',
    instituteName: 'Government Boys Secondary School Clifton',
    categoryId: 'cat_school',
    numericCode: null,
    branch: null,
    answers: [],
    institutionType: InstitutionType.GOVERNMENT,
    address: 'Block 5, Clifton',
    city: 'Karachi',
    province: Province.SINDH,
    postalCode: '75600',
    contactPersonName: 'Sana Malik',
    contactPersonDesignation: 'Headmistress',
    contactEmail: 'head@gbsclifton.edu.pk',
    contactPhone: '+92-21-35870011',
    status: 'pending',
    rejectionReason: null,
    registrationSource: 'public',
    approvedAt: null,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
  {
    id: 'sch_003',
    instituteCode: 'ISB-001',
    instituteName: 'Federal Government School F-8',
    categoryId: 'cat_school',
    numericCode: null,
    branch: null,
    answers: [],
    institutionType: InstitutionType.SEMI_GOVERNMENT,
    address: 'Street 24, F-8/2',
    city: 'Islamabad',
    province: Province.ICT,
    postalCode: '44000',
    contactPersonName: 'Imran Qureshi',
    contactPersonDesignation: 'Principal',
    contactEmail: 'principal@fgsf8.edu.pk',
    contactPhone: '+92-51-2261100',
    status: 'approved',
    rejectionReason: null,
    registrationSource: 'admin',
    approvedAt: SEED_AT,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
];

export function listInstitutes(): Institute[] {
  return institutes;
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
  return institutes.filter((i) => i.status === 'pending');
}

/** How many registrations are awaiting approval (drives the sidebar badge). */
export function countPendingInstitutes(): number {
  return institutes.filter((i) => i.status === 'pending').length;
}

/** Whether an institute code is already used — government codes must be unique. */
export function isInstituteCodeTaken(code: string): boolean {
  const normalized = code.trim().toLowerCase();
  return institutes.some((i) => i.instituteCode.trim().toLowerCase() === normalized);
}

let instituteCounter = institutes.length;

/**
 * Public self-registration → one `pending` application and nothing else.
 *
 * No numeric code: that is drawn at approval and never reissued, so an unapproved application
 * must not carry one. The password the real API collects is deliberately absent here — a mock
 * has nowhere safe to put it, and pretending otherwise would be worse than not modelling it.
 */
export function registerInstitute(dto: RegisterInstituteDto): Institute {
  instituteCounter += 1;
  const now = new Date().toISOString();
  const institute: Institute = {
    id: `sch_new_${instituteCounter}`,
    instituteCode: dto.instituteCode,
    numericCode: null,
    instituteName: dto.instituteName,
    branch: dto.branch ?? null,
    categoryId: dto.categoryId,
    answers: dto.answers ?? [],
    institutionType: dto.institutionType,
    address: dto.address,
    city: dto.city,
    province: dto.province,
    postalCode: dto.postalCode ?? null,
    contactPersonName: dto.contactPersonName,
    contactPersonDesignation: dto.contactPersonDesignation,
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
    status: 'pending',
    rejectionReason: null,
    registrationSource: 'public',
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  institutes.push(institute);
  return institute;
}

/** Approve a pending institute. */
export function approveInstitute(id: string): Institute | undefined {
  const institute = getInstitute(id);
  if (!institute) return undefined;
  institute.status = 'approved';
  institute.approvedAt = new Date().toISOString();
  institute.updatedAt = institute.approvedAt;
  return institute;
}

/** Reject a pending institute, recording why so it can be told what to fix. */
export function rejectInstitute(id: string, reason?: string): Institute | undefined {
  const institute = getInstitute(id);
  if (!institute) return undefined;
  institute.status = 'rejected';
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
