import { SYSTEM_ROLES, SYSTEM_ROLE_IDS } from './system-roles';

function byId(id: string): {
  id: string;
  name: string;
  grants: { action: string; scope: string }[];
} {
  const role = SYSTEM_ROLES.find((r) => r.id === id);
  if (!role) throw new Error(`system role not found: ${id}`);
  return role;
}
const actionsOf = (id: string): string[] =>
  byId(id)
    .grants.map((g) => g.action)
    .sort();

describe('SYSTEM_ROLES seed', () => {
  it('defines exactly the five TRD system roles with stable ids', () => {
    expect(SYSTEM_ROLES.map((r) => r.id).sort()).toEqual(Object.values(SYSTEM_ROLE_IDS).sort());
  });

  /**
   * The ids are pasted constants, so nothing at runtime would notice a hand-written placeholder
   * creeping back in. These assertions are what keeps them genuine v7 keys: version nibble 7,
   * RFC 9562 variant, and a timestamp prefix that is actually a time rather than zeros.
   */
  it('every system role id is a real uuid v7, not a hand-written placeholder', () => {
    const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const [name, id] of Object.entries(SYSTEM_ROLE_IDS)) {
      expect(`${name}:${id}`).toMatch(new RegExp(`^${name}:${V7.source.slice(1, -1)}$`));
      // The first 48 bits are a millisecond timestamp — a plausible one, not 1970.
      const ms = parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
      expect(new Date(ms).getUTCFullYear()).toBeGreaterThanOrEqual(2020);
    }
  });

  it('role ids sort in role order, so a v7 index keeps them contiguous', () => {
    const ids = Object.values(SYSTEM_ROLE_IDS);
    expect([...ids].sort()).toEqual(ids);
  });

  it('Evaluator can only mark and view a dashboard — never PII (anonymity)', () => {
    expect(actionsOf(SYSTEM_ROLE_IDS.checker)).toEqual(['dashboard.view', 'marking.mark']);
    expect(actionsOf(SYSTEM_ROLE_IDS.checker)).not.toContain('students.viewPII');
  });

  it('Super Admin holds every action except personally marking / own-institute results', () => {
    const actions = actionsOf(SYSTEM_ROLE_IDS.superAdmin);
    expect(actions).not.toContain('marking.mark');
    expect(actions).not.toContain('results.viewOwn');
    expect(actions).toContain('students.viewPII');
    expect(actions).toContain('roles.manage');
  });

  it('Institute grants are all own-institute scoped', () => {
    expect(byId(SYSTEM_ROLE_IDS.institute).grants.every((g) => g.scope === 'own-institute')).toBe(
      true,
    );
  });

  it('Admin is limited — no roles / clients / reference-data management', () => {
    const actions = actionsOf(SYSTEM_ROLE_IDS.admin);
    expect(actions).not.toContain('roles.manage');
    expect(actions).not.toContain('clients.manage');
    expect(actions).not.toContain('subjects.manage');
  });

  /**
   * Admin can look an institute up while working on students, exams and registrations, but
   * approving, deactivating or deleting one is a Super Admin decision. The two grants exist so
   * that distinction is a capability rather than a role check in a controller.
   */
  it('Admin can view institutes and categories but not manage them', () => {
    const actions = actionsOf(SYSTEM_ROLE_IDS.admin);
    expect(actions).toContain('institutes.view');
    expect(actions).toContain('institute-categories.view');
    expect(actions).not.toContain('institutes.manage');
    expect(actions).not.toContain('institute-categories.manage');
  });

  it('Super Admin holds both the view and the manage grants', () => {
    const actions = actionsOf(SYSTEM_ROLE_IDS.superAdmin);
    for (const action of [
      'institutes.view',
      'institutes.manage',
      'institute-categories.view',
      'institute-categories.manage',
    ]) {
      expect(actions).toContain(action);
    }
  });

  // The web e-sheet template screens gate on templates.manage. Once grants come from
  // this seed rather than the web mock, dropping it here blanks those screens.
  it('Super Admin, Admin and Controller can manage e-sheet templates', () => {
    for (const id of [
      SYSTEM_ROLE_IDS.superAdmin,
      SYSTEM_ROLE_IDS.admin,
      SYSTEM_ROLE_IDS.controller,
    ]) {
      expect(actionsOf(id)).toContain('templates.manage');
    }
    expect(actionsOf(SYSTEM_ROLE_IDS.checker)).not.toContain('templates.manage');
  });

  it('every non-Institute system role is scoped "all"', () => {
    for (const id of [
      SYSTEM_ROLE_IDS.superAdmin,
      SYSTEM_ROLE_IDS.admin,
      SYSTEM_ROLE_IDS.controller,
      SYSTEM_ROLE_IDS.checker,
    ]) {
      expect(byId(id).grants.every((g) => g.scope === 'all')).toBe(true);
    }
  });
});
