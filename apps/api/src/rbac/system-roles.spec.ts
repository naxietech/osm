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
    expect(actions).toContain('institutes.manage');
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
