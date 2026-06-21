import type { UserRole } from './roles.types';

// SafeUser: never includes password or sensitive fields.
// Use this type for all API responses that return user data.
export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  fullName: string;
  createdAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  schoolId?: string;
}
