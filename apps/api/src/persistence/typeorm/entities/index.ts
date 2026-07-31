import { AuthAuditLogEntity } from './auth-audit-log.entity';
import { PermissionEntity } from './permission.entity';
import { RoleGrantEntity } from './role-grant.entity';
import { RoleEntity } from './role.entity';
import { SessionEntity } from './session.entity';
import { UserEntity } from './user.entity';

export { AuthAuditLogEntity } from './auth-audit-log.entity';
export { PermissionEntity } from './permission.entity';
export { RoleGrantEntity } from './role-grant.entity';
export { RoleEntity } from './role.entity';
export { SessionEntity } from './session.entity';
export { UserEntity } from './user.entity';

/** Every entity in the auth persistence layer — registered with the DataSource + forFeature. */
export const AUTH_ENTITIES = [
  RoleEntity,
  PermissionEntity,
  RoleGrantEntity,
  UserEntity,
  SessionEntity,
  AuthAuditLogEntity,
];
