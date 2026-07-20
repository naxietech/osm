/**
 * Mock auth API. Resolves from a static list of 5 users (one per role) using a
 * shared demo password. Frontend-only — simulates latency, no real backend.
 * TODO: Replace with a real call to the NestJS /auth/login endpoint later.
 */
import { type SafeUser, UserRole } from '@oses/types';

import { SYSTEM_ROLE_IDS } from './roles.service';

export interface LoginResult {
  user: SafeUser;
  token: string;
}

/** Shared demo password for every mock account. */
export const DEMO_PASSWORD = 'password123';

/** Static mock users — one per role. Sign in with the email + DEMO_PASSWORD. */
export const MOCK_USERS: SafeUser[] = [
  {
    id: 'usr_admin',
    email: 'admin@oses.pk',
    role: UserRole.ADMIN,
    roleId: SYSTEM_ROLE_IDS.superAdmin,
    fullName: 'Board Admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_controller',
    email: 'controller@oses.pk',
    role: UserRole.CONTROLLER,
    roleId: SYSTEM_ROLE_IDS.controller,
    fullName: 'Examiner',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_evaluator',
    email: 'evaluator@oses.pk',
    role: UserRole.EVALUATOR,
    roleId: SYSTEM_ROLE_IDS.checker,
    fullName: 'Checker',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_school',
    email: 'school@oses.pk',
    role: UserRole.INSTITUTE,
    roleId: SYSTEM_ROLE_IDS.institute,
    instituteId: 'sch_001', // ties institute staff to their institute (drives exam registration scope)
    fullName: 'Institute Staff',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

/** Fake JWT-ish token (base64 payload, unsigned) — mock only. */
function makeToken(user: SafeUser): string {
  const payload = btoa(JSON.stringify({ sub: user.id, role: user.role }));
  return `mock.${payload}.signature`;
}

function login(email: string, password: string): Promise<LoginResult> {
  return new Promise<LoginResult>((resolve, reject) => {
    setTimeout(() => {
      const user = MOCK_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || password !== DEMO_PASSWORD) {
        reject(new Error('Invalid email or password.'));
        return;
      }
      resolve({ user, token: makeToken(user) });
    }, 700);
  });
}

export const authService = { login };
