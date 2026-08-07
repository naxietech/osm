/**
 * **Superseded for institutes themselves — see `institutes.service.ts` (plural).** The
 * institute list, registration, approval and rejection are all live against the API now, and
 * every screen that does that work goes through `use-institutes.ts`. Reading or writing an
 * institute through this file would show a different set of records than the rest of the app.
 *
 * What is left here is a *seed for other mocks*: `INSTITUTE_OPTIONS` and `instituteName()`,
 * which let the still-mocked modules (users, roles, checkers, exams) name and pick an institute
 * without any of them inventing their own list. Those callers go live when their own modules do
 * — at which point this file, and the seed array behind it, goes away entirely.
 *
 * Do not add anything here. New institute behaviour belongs in `institutes.service.ts`.
 */
import { type Institute, InstitutionType, Province } from '@oses/types';

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
