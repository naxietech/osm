import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_CATALOG, SYSTEM_ROLE_IDS, rolesService } from './roles.service';

const ROLES = [
  {
    id: 'role_super_admin',
    name: 'Super Admin',
    isSystem: true,
    grants: [{ action: 'users.manage', scope: 'all' }],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rolesService.listRoles', () => {
  it('unwraps the role list from the envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: ROLES, timestamp: 'now' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(rolesService.listRoles()).resolves.toEqual(ROLES);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/roles');
  });
});

describe('SYSTEM_ROLE_IDS', () => {
  it('matches the ids the API seeds', () => {
    // These are referenced by id across the app (checker approval picks role_checker),
    // so they must stay in step with apps/api/src/rbac/system-roles.ts.
    expect(SYSTEM_ROLE_IDS).toEqual({
      superAdmin: 'role_super_admin',
      admin: 'role_admin',
      institute: 'role_institute',
      checker: 'role_checker',
      controller: 'role_controller',
    });
  });
});

describe('PERMISSION_CATALOG', () => {
  it('describes every action exactly once', () => {
    const actions = PERMISSION_CATALOG.map((p) => p.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it('covers the actions the role screens have to label', () => {
    const actions = PERMISSION_CATALOG.map((p) => p.action);
    expect(actions).toEqual(
      expect.arrayContaining(['students.viewPII', 'marking.mark', 'templates.manage']),
    );
  });
});
