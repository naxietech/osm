import type { UserRole } from './roles.types';

// SafeUser: never includes password or sensitive fields.
// Use this type for all API responses that return user data.
export interface SafeUser {
  id: string;
  email: string;
  role: UserRole; // legacy enum — retained during the RBAC transition
  roleId?: string; // references a Role (data-driven RBAC); resolves grants
  instituteId?: string;
  fullName: string;
  createdAt: string;
}

export interface CreateUserDto {
  email: string;
  password?: string; // set by the super admin / server-side; optional in the client mock
  roleId: string; // the assigned Role
  fullName: string;
  instituteId?: string;
}
