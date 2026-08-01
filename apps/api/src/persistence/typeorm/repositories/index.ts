import type { Provider } from '@nestjs/common';

import {
  CATEGORY_REFERENCE_PROBE,
  INSTITUTE_CATEGORY_REPOSITORY,
} from '../../../modules/institute-categories/ports';
import { NoCategoryReferencesProbe } from './category-reference.probe';
import { TypeOrmInstituteCategoryRepository } from './institute-category.repository';

export { AUTH_REPOSITORY_PROVIDERS } from './auth.repositories';
export { NoCategoryReferencesProbe } from './category-reference.probe';
export { TypeOrmInstituteCategoryRepository } from './institute-category.repository';

/** Binds the institute-category ports to their implementations. */
export const INSTITUTE_CATEGORY_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: INSTITUTE_CATEGORY_REPOSITORY, useClass: TypeOrmInstituteCategoryRepository },
  { provide: CATEGORY_REFERENCE_PROBE, useClass: NoCategoryReferencesProbe },
];
