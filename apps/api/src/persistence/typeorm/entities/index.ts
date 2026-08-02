import { AuthAuditLogEntity } from './auth-audit-log.entity';
import { InstituteCategoryQuestionEntity } from './institute-category-question.entity';
import { InstituteCategoryEntity } from './institute-category.entity';
import { PermissionEntity } from './permission.entity';
import { RoleGrantEntity } from './role-grant.entity';
import { RoleEntity } from './role.entity';
import { SessionEntity } from './session.entity';
import { UserEntity } from './user.entity';

export { AuthAuditLogEntity } from './auth-audit-log.entity';
export { InstituteCategoryQuestionEntity } from './institute-category-question.entity';
export { InstituteCategoryEntity } from './institute-category.entity';
export { PermissionEntity } from './permission.entity';
export { RoleGrantEntity } from './role-grant.entity';
export { RoleEntity } from './role.entity';
export { SessionEntity } from './session.entity';
export { UserEntity } from './user.entity';

/** Every entity in the auth persistence layer — registered with `forFeature` by AuthModule. */
export const AUTH_ENTITIES = [
  RoleEntity,
  PermissionEntity,
  RoleGrantEntity,
  UserEntity,
  SessionEntity,
  AuthAuditLogEntity,
];

/** Super-admin-managed reference data (institute categories + their dynamic questions). */
export const REFERENCE_ENTITIES = [InstituteCategoryEntity, InstituteCategoryQuestionEntity];

/** Everything the DataSource must know about. Feature modules still scope their own forFeature. */
export const ALL_ENTITIES = [...AUTH_ENTITIES, ...REFERENCE_ENTITIES];
