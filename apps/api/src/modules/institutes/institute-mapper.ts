import type { DuplicateWarning, Institute } from '@oses/types';

import type { DuplicateCandidate, InstituteRecord } from './ports';

/**
 * The admin view of an institute — the shared `Institute` shape from `@oses/types`, built field
 * by field.
 *
 * Deliberately not a spread of the record. A spread would publish every column added to
 * `institutes` from now on automatically, which is how an internal field ends up in an API
 * response a year later. Listing them is the one place a reviewer can see what leaves the server.
 */
export function toAdminInstitute(record: InstituteRecord): Institute {
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

export function toDuplicateWarning(candidate: DuplicateCandidate): DuplicateWarning {
  return {
    id: candidate.id,
    instituteName: candidate.instituteName,
    branch: candidate.branch,
    city: candidate.city,
    status: candidate.status,
  };
}
