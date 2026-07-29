import { UserRole } from '@oses/types';

import { legacyRoleFor } from './legacy-role';
import { SYSTEM_ROLE_IDS } from './system-roles';

describe('legacyRoleFor', () => {
  it('maps every seeded role id 1:1 to the enum', () => {
    expect(legacyRoleFor(SYSTEM_ROLE_IDS.superAdmin)).toBe(UserRole.SUPER_ADMIN);
    expect(legacyRoleFor(SYSTEM_ROLE_IDS.admin)).toBe(UserRole.ADMIN);
    expect(legacyRoleFor(SYSTEM_ROLE_IDS.controller)).toBe(UserRole.CONTROLLER);
    expect(legacyRoleFor(SYSTEM_ROLE_IDS.checker)).toBe(UserRole.EVALUATOR);
    expect(legacyRoleFor(SYSTEM_ROLE_IDS.institute)).toBe(UserRole.INSTITUTE);
  });

  it('throws on an unmapped roleId instead of guessing a role (#6)', () => {
    expect(() => legacyRoleFor('role_does_not_exist')).toThrow(/Unmapped roleId/);
  });
});
