import type { Provider } from '@nestjs/common';

import { CLASS_REPOSITORY } from '../../../modules/classes/ports';
import {
  CATEGORY_REFERENCE_PROBE,
  INSTITUTE_CATEGORY_REPOSITORY,
} from '../../../modules/institute-categories/ports';
import { NoCategoryReferencesProbe } from './category-reference.probe';
import { TypeOrmClassRepository } from './class.repository';
import { TypeOrmInstituteCategoryRepository } from './institute-category.repository';

export { AUTH_REPOSITORY_PROVIDERS } from './auth.repositories';
export { NoCategoryReferencesProbe } from './category-reference.probe';
export { TypeOrmClassRepository } from './class.repository';
export { TypeOrmInstituteCategoryRepository } from './institute-category.repository';

/** Binds the institute-category ports to their implementations. */
export const INSTITUTE_CATEGORY_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: INSTITUTE_CATEGORY_REPOSITORY, useClass: TypeOrmInstituteCategoryRepository },
  { provide: CATEGORY_REFERENCE_PROBE, useClass: NoCategoryReferencesProbe },
];

/** Binds the class port to its implementation. One repository covers both class tables. */
export const CLASS_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: CLASS_REPOSITORY, useClass: TypeOrmClassRepository },
];
