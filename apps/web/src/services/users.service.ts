/**
 * Mock users service (frontend only) — the super-admin Users store.
 *
 * All logins are created here by the super admin (institutes don't self-manage users).
 * Many users can share one instituteId, each with a single roleId. Seeded from the auth
 * demo accounts plus a couple of extra institute users to show multiple-per-institute.
 *
 * SafeUser still carries the legacy `role` enum (drives which portal the user lands in
 * until route gating is fully permission-based); we infer it from the assigned role's
 * grants so a user created with a custom role still routes sensibly.
 *
 * TODO: replace with a real usersApi + server-side RBAC.
 */
import { type CreateUserDto, type Role, type SafeUser, UserRole } from '@oses/types';

import { MOCK_USERS } from './auth.service';
import { getRole } from './roles.service';

/** Institutes available to assign a user to (mock — matches the institutes list seed). */
export const INSTITUTE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sch_001', label: 'Government High School Gulberg' },
  { value: 'sch_002', label: 'Government Boys Secondary School Clifton' },
  { value: 'sch_003', label: 'Federal Government School F-8' },
];

export function instituteName(id: string | undefined): string {
  return (id && INSTITUTE_OPTIONS.find((o) => o.value === id)?.label) || '—';
}

/** Infer the transitional portal role from a role's grants (until routing is permission-based). */
function legacyRoleFor(role: Role | undefined): UserRole {
  if (!role) return UserRole.INSTITUTE;
  const has = (action: string): boolean => role.grants.some((g) => g.action === action);
  if (has('institutes.manage') || has('roles.manage') || has('users.manage')) return UserRole.ADMIN;
  if (has('marking.mark')) return UserRole.EVALUATOR;
  if (has('marking.supervise') || has('results.viewAll')) return UserRole.CONTROLLER;
  return UserRole.INSTITUTE;
}

/** Mutable users store, seeded with the demo accounts + extra institute users. */
export const users: SafeUser[] = [
  ...MOCK_USERS,
  {
    id: 'usr_school_2',
    email: 'registrar@gulberg.edu.pk',
    role: UserRole.INSTITUTE,
    roleId: 'role_institute',
    instituteId: 'sch_001',
    fullName: 'Ayesha Khan',
    createdAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: 'usr_school_3',
    email: 'dataentry@gulberg.edu.pk',
    role: UserRole.INSTITUTE,
    roleId: 'role_institute',
    instituteId: 'sch_001',
    fullName: 'Bilal Ahmed',
    createdAt: '2026-02-01T00:00:00.000Z',
  },
];

export function listUsers(): SafeUser[] {
  return users;
}

let userCounter = users.length;

export function createUser(dto: CreateUserDto): SafeUser {
  userCounter += 1;
  const role = getRole(dto.roleId);
  const user: SafeUser = {
    id: `usr_${userCounter}`,
    email: dto.email,
    role: legacyRoleFor(role),
    roleId: dto.roleId,
    fullName: dto.fullName,
    createdAt: new Date().toISOString(),
    ...(dto.instituteId ? { instituteId: dto.instituteId } : {}),
  };
  users.push(user);
  return user;
}
