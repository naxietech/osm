import { ALL_PERMISSION_ACTIONS } from './permissions.constants';

describe('ALL_PERMISSION_ACTIONS', () => {
  it('lists all 23 catalogue actions with no duplicates', () => {
    expect(ALL_PERMISSION_ACTIONS).toHaveLength(23);
    expect(new Set(ALL_PERMISSION_ACTIONS).size).toBe(23);
  });

  it('includes the security-critical actions', () => {
    expect(ALL_PERMISSION_ACTIONS).toEqual(
      expect.arrayContaining(['students.viewPII', 'marking.mark', 'roles.manage']),
    );
  });

  // The web e-sheet screens gate on this; it was missing from the catalogue while
  // @oses/types already declared it, which broke the api build.
  it('includes templates.manage', () => {
    expect(ALL_PERMISSION_ACTIONS).toContain('templates.manage');
  });
});
