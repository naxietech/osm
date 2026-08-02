import type { Provider } from '@nestjs/common';

import {
  CATEGORY_REFERENCE_PROBE,
  INSTITUTE_CATEGORY_REPOSITORY,
} from '../../../modules/institute-categories/ports';
import { SUBJECT_REPOSITORY } from '../../../modules/subjects/ports';
import { NoCategoryReferencesProbe } from './category-reference.probe';
import { TypeOrmInstituteCategoryRepository } from './institute-category.repository';
import { TypeOrmSubjectRepository } from './subject.repository';

export { AUTH_REPOSITORY_PROVIDERS } from './auth.repositories';
export { NoCategoryReferencesProbe } from './category-reference.probe';
export { TypeOrmInstituteCategoryRepository } from './institute-category.repository';
export { TypeOrmSubjectRepository } from './subject.repository';

/** Binds the institute-category ports to their implementations. */
export const INSTITUTE_CATEGORY_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: INSTITUTE_CATEGORY_REPOSITORY, useClass: TypeOrmInstituteCategoryRepository },
  { provide: CATEGORY_REFERENCE_PROBE, useClass: NoCategoryReferencesProbe },
];

/** Binds the subject port to its implementation. */
export const SUBJECT_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: SUBJECT_REPOSITORY, useClass: TypeOrmSubjectRepository },
];
