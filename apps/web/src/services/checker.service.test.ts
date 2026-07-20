import { describe, expect, it } from 'vitest';

import { Province } from '@oses/types';

import {
  approveChecker,
  countPendingCheckers,
  createChecker,
  getChecker,
  isCheckerCnicTaken,
  listCheckers,
  rejectChecker,
} from './checker.service';
import { listUsers } from './users.service';

const BASE = {
  fullName: 'Test Checker',
  fatherOrGuardianName: 'Test Father',
  gender: 'male' as const,
  dateOfBirth: '1985-01-01',
  email: 'test.checker@example.pk',
  mobile: '03001112223',
  address: 'Somewhere',
  city: 'Lahore',
  province: Province.PUNJAB,
  highestQualification: 'M.Sc.',
  specialization: 'Physics',
  yearsTeachingExperience: 5,
  yearsMarkingExperience: 2,
  subjectIds: ['sub_phy'],
  levelIds: ['lvl_10'],
  documents: [{ kind: 'qualification' as const, fileName: 'cert.pdf' }],
  declarationAccepted: true,
};

describe('checker.service', () => {
  it('creates every checker as pending, whoever added it', () => {
    const byInstitute = createChecker({
      ...BASE,
      cnic: '11111-1111111-1',
      checkerType: 'school-specific',
      instituteId: 'sch_001',
      addedBy: 'institute',
      addedByInstituteId: 'sch_001',
    });
    expect(byInstitute.status).toBe('pending');

    const bySuperAdmin = createChecker({
      ...BASE,
      cnic: '22222-2222222-2',
      checkerType: 'general',
      addedBy: 'super-admin',
    });
    expect(bySuperAdmin.status).toBe('pending');
  });

  it('never binds a general checker to an institute, even if one is passed', () => {
    const checker = createChecker({
      ...BASE,
      cnic: '33333-3333333-3',
      checkerType: 'general',
      instituteId: 'sch_003',
      addedBy: 'super-admin',
    });
    expect(checker.instituteId).toBeUndefined();
  });

  it('creates the Evaluator login on approval, bound to the same institute', () => {
    const checker = createChecker({
      ...BASE,
      cnic: '44444-4444444-4',
      email: 'approved.checker@example.pk',
      checkerType: 'school-specific',
      instituteId: 'sch_002',
      addedBy: 'institute',
      addedByInstituteId: 'sch_002',
    });
    expect(checker.userId).toBeUndefined();

    const approved = approveChecker(checker.id);
    expect(approved?.status).toBe('approved');
    expect(approved?.userId).toBeDefined();

    const user = listUsers().find((u) => u.id === approved?.userId);
    expect(user?.email).toBe('approved.checker@example.pk');
    expect(user?.instituteId).toBe('sch_002');
  });

  it('does not create a second login when approved twice', () => {
    const checker = createChecker({
      ...BASE,
      cnic: '55555-5555555-5',
      email: 'twice@example.pk',
      checkerType: 'general',
      addedBy: 'super-admin',
    });
    const first = approveChecker(checker.id)?.userId;
    const second = approveChecker(checker.id)?.userId;
    expect(first).toBe(second);
    expect(listUsers().filter((u) => u.email === 'twice@example.pk')).toHaveLength(1);
  });

  it('records a rejection reason and drops it again on later approval', () => {
    const checker = createChecker({
      ...BASE,
      cnic: '66666-6666666-6',
      email: 'rejected@example.pk',
      checkerType: 'general',
      addedBy: 'super-admin',
    });
    rejectChecker(checker.id, '  Qualification certificate unreadable.  ');
    expect(getChecker(checker.id)?.status).toBe('rejected');
    expect(getChecker(checker.id)?.rejectionReason).toBe('Qualification certificate unreadable.');

    approveChecker(checker.id);
    expect(getChecker(checker.id)?.rejectionReason).toBeUndefined();
  });

  it('flags a duplicate CNIC regardless of dash formatting', () => {
    createChecker({
      ...BASE,
      cnic: '77777-7777777-7',
      checkerType: 'general',
      addedBy: 'super-admin',
    });
    // Same 13 digits, no dashes.
    expect(isCheckerCnicTaken('7777777777777')).toBe(true);
    expect(isCheckerCnicTaken('99999-9999999-9')).toBe(false);
  });

  it('scopes the list to an institute when one is given', () => {
    const all = listCheckers();
    const scoped = listCheckers('sch_001');
    expect(scoped.length).toBeLessThan(all.length);
    expect(scoped.every((c) => c.instituteId === 'sch_001')).toBe(true);
  });

  it('counts only pending registrations', () => {
    const pending = countPendingCheckers();
    expect(pending).toBe(listCheckers().filter((c) => c.status === 'pending').length);
  });
});
