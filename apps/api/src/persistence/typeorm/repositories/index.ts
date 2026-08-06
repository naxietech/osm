import type { Provider } from '@nestjs/common';

import {
  CATEGORY_REFERENCE_PROBE,
  INSTITUTE_CATEGORY_REPOSITORY,
} from '../../../modules/institute-categories/ports';
import {
  ACCOUNT_LOOKUP,
  CATEGORY_LOOKUP,
  INSTITUTE_APPROVAL_REPOSITORY,
  INSTITUTE_CREDENTIAL_REPOSITORY,
  INSTITUTE_DEPENDANTS,
  INSTITUTE_REPOSITORY,
} from '../../../modules/institutes/ports';
import { TypeOrmInstituteApprovalRepository } from './institute-approval.repository';
import { TypeOrmInstituteCategoryRepository } from './institute-category.repository';
import {
  TypeOrmAccountLookup,
  TypeOrmCategoryLookup,
  TypeOrmCategoryReferenceProbe,
  TypeOrmInstituteCredentialRepository,
  TypeOrmInstituteDependants,
} from './institute-support.repositories';
import { TypeOrmInstituteRepository } from './institute.repository';

export { AUTH_REPOSITORY_PROVIDERS } from './auth.repositories';
export { TypeOrmInstituteApprovalRepository } from './institute-approval.repository';
export { TypeOrmInstituteCategoryRepository } from './institute-category.repository';
export {
  TypeOrmAccountLookup,
  TypeOrmCategoryLookup,
  TypeOrmCategoryReferenceProbe,
  TypeOrmInstituteCredentialRepository,
  TypeOrmInstituteDependants,
} from './institute-support.repositories';
export { TypeOrmInstituteRepository } from './institute.repository';

/**
 * Binds the institute-category ports to their implementations.
 *
 * `CATEGORY_REFERENCE_PROBE` now resolves to the querying implementation. It previously used
 * `NoCategoryReferencesProbe`, a placeholder that answered "nothing references this" because
 * institutes did not exist. The rules that consume it were written and tested against that
 * placeholder; switching this one line is what turns them on.
 */
export const INSTITUTE_CATEGORY_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: INSTITUTE_CATEGORY_REPOSITORY, useClass: TypeOrmInstituteCategoryRepository },
  { provide: CATEGORY_REFERENCE_PROBE, useClass: TypeOrmCategoryReferenceProbe },
];

/** Binds the institutes module's ports to their implementations. */
export const INSTITUTE_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: INSTITUTE_REPOSITORY, useClass: TypeOrmInstituteRepository },
  { provide: INSTITUTE_APPROVAL_REPOSITORY, useClass: TypeOrmInstituteApprovalRepository },
  { provide: INSTITUTE_CREDENTIAL_REPOSITORY, useClass: TypeOrmInstituteCredentialRepository },
  { provide: INSTITUTE_DEPENDANTS, useClass: TypeOrmInstituteDependants },
  { provide: CATEGORY_LOOKUP, useClass: TypeOrmCategoryLookup },
  { provide: ACCOUNT_LOOKUP, useClass: TypeOrmAccountLookup },
];
