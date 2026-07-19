import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_IDS, getRole, listRoles } from './roles.service';

/** The TRD's five default roles, all seeded as system roles. */
describe('roles.service seed (5 TRD roles)', () => {
  it('seeds exactly the five system roles', () => {
    const system = listRoles().filter((r) => r.isSystem);
    expect(system.map((r) => r.name)).toEqual([
      'Super Admin',
      'Admin',
      'Controller Examiner',
      'Evaluator',
      'Institute',
    ]);
  });

  it('Super Admin has full access but never marks', () => {
    const sa = getRole(SYSTEM_ROLE_IDS.superAdmin);
    const actions = sa?.grants.map((g) => g.action) ?? [];
    expect(actions).toContain('roles.manage');
    expect(actions).toContain('clients.manage');
    expect(actions).not.toContain('marking.mark');
  });

  it('Admin is limited back-office — data yes, no roles/clients/reference data', () => {
    const admin = getRole(SYSTEM_ROLE_IDS.admin);
    const actions = admin?.grants.map((g) => g.action) ?? [];
    // manages operational data
    expect(actions).toContain('institutes.manage');
    expect(actions).toContain('students.manage');
    expect(actions).toContain('exams.manage');
    // but NOT the super-admin-only surfaces
    expect(actions).not.toContain('roles.manage');
    expect(actions).not.toContain('clients.manage');
    expect(actions).not.toContain('institute-categories.manage');
    expect(actions).not.toContain('subjects.manage');
  });

  it('Controller Examiner creates exams and supervises marking', () => {
    const ce = getRole(SYSTEM_ROLE_IDS.controller);
    const actions = ce?.grants.map((g) => g.action) ?? [];
    expect(actions).toContain('exams.manage');
    expect(actions).toContain('marking.supervise');
    expect(actions).not.toContain('marking.mark');
  });

  it('Evaluator marks scripts only', () => {
    const ev = getRole(SYSTEM_ROLE_IDS.checker);
    expect(ev?.name).toBe('Evaluator');
    expect(ev?.grants.map((g) => g.action)).toContain('marking.mark');
  });

  it('Institute is scoped to its own institute', () => {
    const inst = getRole(SYSTEM_ROLE_IDS.institute);
    expect(inst?.grants.every((g) => g.scope === 'own-institute')).toBe(true);
  });
});
