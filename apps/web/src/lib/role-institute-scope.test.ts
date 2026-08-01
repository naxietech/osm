import { describe, expect, it } from 'vitest';

import type { PermissionGrant, Role } from '@oses/types';

import { instituteRequirementFor, showsInstitutePicker } from './role-institute-scope';

function role(overrides: Partial<Role> & Pick<Role, 'id'>): Role {
  return {
    name: 'Test Role',
    isSystem: true,
    grants: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ownInstitute: PermissionGrant[] = [{ action: 'students.manage', scope: 'own-institute' }];
const global: PermissionGrant[] = [{ action: 'exams.manage', scope: 'all' }];

describe('instituteRequirementFor', () => {
  it('requires one for a role with own-institute grants', () => {
    expect(instituteRequirementFor(role({ id: 'role_institute', grants: ownInstitute }))).toBe(
      'required',
    );
  });

  it('requires one for a role owned by an institute', () => {
    expect(
      instituteRequirementFor(
        role({ id: 'role_custom_1', instituteId: 'sch_001', grants: global }),
      ),
    ).toBe('required');
  });

  it('offers one to an Evaluator without demanding it', () => {
    // An evaluator with an institute is school-specific; without one they are a general
    // evaluator who marks across all institutes. Both are valid, so neither is forced.
    expect(instituteRequirementFor(role({ id: 'role_checker', grants: global }))).toBe('optional');
  });

  it('wants none for the global roles', () => {
    for (const id of ['role_super_admin', 'role_admin', 'role_controller']) {
      expect(instituteRequirementFor(role({ id, grants: global }))).toBe('none');
    }
  });

  it('wants none when no role is chosen yet', () => {
    expect(instituteRequirementFor(undefined)).toBe('none');
  });
});

describe('showsInstitutePicker', () => {
  it('shows for required and optional, hides for none', () => {
    expect(showsInstitutePicker(role({ id: 'role_institute', grants: ownInstitute }))).toBe(true);
    expect(showsInstitutePicker(role({ id: 'role_checker', grants: global }))).toBe(true);
    expect(showsInstitutePicker(role({ id: 'role_super_admin', grants: global }))).toBe(false);
    expect(showsInstitutePicker(undefined)).toBe(false);
  });
});
