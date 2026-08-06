import type { InstituteStatus, InstitutionType, Province, RegistrationSource } from '@oses/types';

import type { DuplicateCandidate, InstituteRecord } from './ports';

/** The admin view of an institute — every field the directory and detail screen show. */
export interface AdminInstitute {
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
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  answers: Array<{ questionId: string; values: string[] }>;
}

/**
 * Field by field, deliberately — never a spread of the record.
 *
 * A spread would mean every column added to `institutes` from now on is published automatically,
 * which is how an internal field ends up in an API response a year later. Listing them is the
 * one place a reviewer can see exactly what leaves the server.
 */
export function toAdminInstitute(record: InstituteRecord): AdminInstitute {
  return {
    id: record.id,
    instituteCode: record.instituteCode,
    numericCode: record.numericCode,
    instituteName: record.instituteName,
    branch: record.branch,
    categoryId: record.categoryId,
    institutionType: record.institutionType,
    address: record.address,
    city: record.city,
    province: record.province,
    postalCode: record.postalCode,
    contactPersonName: record.contactPersonName,
    contactPersonDesignation: record.contactPersonDesignation,
    contactEmail: record.contactEmail,
    contactPhone: record.contactPhone,
    status: record.status,
    rejectionReason: record.rejectionReason,
    registrationSource: record.registrationSource,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    answers: record.answers.map((answer) => ({
      questionId: answer.questionId,
      values: [...answer.values],
    })),
  };
}

/** A possible duplicate, as the approval screen shows it. */
export interface DuplicateWarning {
  id: string;
  instituteName: string;
  branch: string | null;
  city: string;
  status: InstituteStatus;
}

export function toDuplicateWarning(candidate: DuplicateCandidate): DuplicateWarning {
  return {
    id: candidate.id,
    instituteName: candidate.instituteName,
    branch: candidate.branch,
    city: candidate.city,
    status: candidate.status,
  };
}
