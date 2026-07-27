import { ALL_PERMISSION_ACTIONS } from './permissions.constants';

describe('ALL_PERMISSION_ACTIONS', () => {
  it('lists all 22 catalogue actions with no duplicates', () => {
    expect(ALL_PERMISSION_ACTIONS).toHaveLength(22);
    expect(new Set(ALL_PERMISSION_ACTIONS).size).toBe(22);
  });

  it('includes the security-critical actions', () => {
    expect(ALL_PERMISSION_ACTIONS).toEqual(
      expect.arrayContaining(['students.viewPII', 'marking.mark', 'roles.manage']),
    );
  });
});
