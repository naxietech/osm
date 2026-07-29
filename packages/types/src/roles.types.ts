/**
 * The five permanent system roles. These map 1:1 to the seeded `role_*` ids in the
 * backend (`SYSTEM_ROLE_IDS`): SUPER_ADMIN↔role_super_admin, ADMIN↔role_admin,
 * CONTROLLER↔role_controller, EVALUATOR↔role_checker, INSTITUTE↔role_institute.
 * Fine-grained authorization keys off `roleId` + permission grants, not this enum;
 * the enum stays as the coarse legacy label carried on `SafeUser.role` / the token.
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  CONTROLLER = 'CONTROLLER',
  EVALUATOR = 'EVALUATOR',
  INSTITUTE = 'INSTITUTE',
}
