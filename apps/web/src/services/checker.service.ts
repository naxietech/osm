/**
 * Mock checker service (frontend only) — the checker (evaluator / paper marker) registry.
 *
 * Two entry points, one gate:
 *   • an INSTITUTE adds a checker — the record is forced onto that institute, so a
 *     school-specific checker can never be attached to a school it doesn't belong to;
 *   • the SUPER ADMIN adds a checker — and may additionally create a `general` one.
 * Either way the record lands PENDING in the super admin's approval queue. Approving is
 * what creates the Evaluator login, so an unapproved checker cannot sign in at all.
 *
 * TODO: replace with a real checkersApi + server-side document storage.
 */
import {
  type Checker,
  type CheckerListItem,
  type CheckerStatus,
  type CreateCheckerDto,
  Province,
  type UpdateCheckerDto,
} from '@oses/types';

import { SYSTEM_ROLE_IDS } from './roles.service';
import { createUser } from './users.service';

const SEED_AT = '2026-03-01T09:00:00.000Z';

/** Mutable checker store. */
export const checkers: Checker[] = [
  {
    id: 'chk_001',
    checkerRefId: 'chk-ref-4a91',
    checkerType: 'school-specific',
    instituteId: 'sch_001',
    fullName: 'Nadia Iqbal',
    fatherOrGuardianName: 'Iqbal Hussain',
    cnic: '35202-4451209-8',
    gender: 'female',
    dateOfBirth: '1986-11-02',
    email: 'nadia.iqbal@ghsg.edu.pk',
    mobile: '03004451209',
    address: 'House 8, Street 11, Gulberg III',
    city: 'Lahore',
    district: 'Lahore',
    province: Province.PUNJAB,
    highestQualification: 'M.Sc. Chemistry',
    specialization: 'Chemistry',
    designation: 'Senior Teacher',
    currentEmployer: 'Government High School Gulberg',
    yearsTeachingExperience: 12,
    yearsMarkingExperience: 6,
    subjectIds: ['sub_chem', 'sub_phy', 'sub_bio'],
    levelIds: ['lvl_9', 'lvl_10', 'lvl_12'],
    dailyCapacity: 40,
    documents: [
      { kind: 'qualification', fileName: 'msc-chemistry.pdf' },
      { kind: 'cnic', fileName: 'cnic-front.jpg' },
      { kind: 'nomination', fileName: 'ghsg-nomination.pdf' },
    ],
    declarationAccepted: true,
    status: 'approved',
    addedBy: 'institute',
    addedByInstituteId: 'sch_001',
    // The demo Evaluator login (auth.service MOCK_USERS) — this is the record that
    // signing in as evaluator@oses.pk resolves to, via findCheckerByUserId.
    userId: 'usr_evaluator',
    approvedAt: SEED_AT,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
  {
    id: 'chk_002',
    checkerRefId: 'chk-ref-7c30',
    checkerType: 'general',
    fullName: 'Imran Shah',
    fatherOrGuardianName: 'Shah Nawaz',
    cnic: '61101-9982314-3',
    gender: 'male',
    dateOfBirth: '1979-06-21',
    email: 'imran.shah@example.pk',
    mobile: '03219982314',
    address: 'Flat 4B, Blue Area',
    city: 'Islamabad',
    district: 'Islamabad',
    province: Province.ICT,
    highestQualification: 'M.Phil. Mathematics',
    specialization: 'Mathematics',
    designation: 'Lecturer',
    currentEmployer: 'Federal College',
    yearsTeachingExperience: 18,
    yearsMarkingExperience: 11,
    subjectIds: ['sub_math', 'sub_phy'],
    levelIds: ['lvl_11', 'lvl_12'],
    dailyCapacity: 55,
    documents: [{ kind: 'qualification', fileName: 'mphil-maths.pdf' }],
    declarationAccepted: true,
    status: 'pending',
    addedBy: 'super-admin',
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
  {
    id: 'chk_003',
    checkerRefId: 'chk-ref-b512',
    checkerType: 'school-specific',
    instituteId: 'sch_002',
    fullName: 'Sadia Rehman',
    fatherOrGuardianName: 'Rehman Ali',
    cnic: '42101-3320145-6',
    gender: 'female',
    dateOfBirth: '1990-02-14',
    email: 'sadia.rehman@gbsclifton.edu.pk',
    mobile: '03453320145',
    address: 'Block 5, Clifton',
    city: 'Karachi',
    district: 'Karachi South',
    province: Province.SINDH,
    highestQualification: 'M.A. English',
    specialization: 'English Literature',
    currentEmployer: 'Government Boys Secondary School Clifton',
    yearsTeachingExperience: 7,
    yearsMarkingExperience: 2,
    subjectIds: ['sub_eng'],
    levelIds: ['lvl_9'],
    dailyCapacity: 30,
    documents: [
      { kind: 'qualification', fileName: 'ma-english.pdf' },
      { kind: 'nomination', fileName: 'clifton-nomination.pdf' },
    ],
    declarationAccepted: true,
    status: 'pending',
    addedBy: 'institute',
    addedByInstituteId: 'sch_002',
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
];

function toListItem(c: Checker): CheckerListItem {
  return {
    id: c.id,
    checkerRefId: c.checkerRefId,
    fullName: c.fullName,
    checkerType: c.checkerType,
    ...(c.instituteId ? { instituteId: c.instituteId } : {}),
    subjectIds: c.subjectIds,
    status: c.status,
    yearsMarkingExperience: c.yearsMarkingExperience,
  };
}

/**
 * Checkers visible to the caller. Pass an `instituteId` to scope the list to one
 * institute's own checkers — that is what the `own-institute` grant means here.
 */
export function listCheckers(instituteId?: string): CheckerListItem[] {
  const rows = instituteId
    ? checkers.filter((c) => c.instituteId === instituteId || c.addedByInstituteId === instituteId)
    : checkers;
  return rows.map(toListItem);
}

export function getChecker(id: string): Checker | undefined {
  return checkers.find((c) => c.id === id);
}

/**
 * The checker record behind a signed-in Evaluator. Approval is what mints the login and
 * stores its `userId`, so this is the only link from an authenticated user back to their
 * own registration — it is how the checker's dashboard knows whose workload to load.
 */
export function findCheckerByUserId(userId: string): Checker | undefined {
  return checkers.find((c) => c.userId === userId);
}

/** Registrations awaiting the super admin's decision. */
export function listPendingCheckers(): Checker[] {
  return checkers.filter((c) => c.status === 'pending');
}

/** How many are awaiting approval (drives the sidebar badge). */
export function countPendingCheckers(): number {
  return listPendingCheckers().length;
}

/** CNIC uniquely identifies a person — the same one must not be registered twice. */
export function isCheckerCnicTaken(cnic: string, exceptId?: string): boolean {
  const normalized = cnic.replace(/\D/g, '');
  return checkers.some(
    (c) => c.id !== exceptId && c.cnic.replace(/\D/g, '') === normalized && normalized.length > 0,
  );
}

/** How many approved checkers an institute holds (guards institute delete later). */
export function countCheckersForInstitute(instituteId: string): number {
  return checkers.filter((c) => c.instituteId === instituteId).length;
}

let checkerCounter = checkers.length;

/**
 * Create a checker. Always lands PENDING regardless of who added it — an institute
 * vouching for its own staff still goes through the super admin's gate.
 */
export function createChecker(dto: CreateCheckerDto): Checker {
  checkerCounter += 1;
  const now = new Date().toISOString();
  // A general checker is bound to no institute, whatever the caller passed.
  const instituteId = dto.checkerType === 'school-specific' ? dto.instituteId : undefined;

  const checker: Checker = {
    id: `chk_new_${checkerCounter}`,
    checkerRefId: `chk-ref-${checkerCounter.toString(16).padStart(4, '0')}`,
    checkerType: dto.checkerType,
    ...(instituteId ? { instituteId } : {}),
    fullName: dto.fullName,
    fatherOrGuardianName: dto.fatherOrGuardianName,
    cnic: dto.cnic,
    gender: dto.gender,
    dateOfBirth: dto.dateOfBirth,
    email: dto.email,
    mobile: dto.mobile,
    address: dto.address,
    city: dto.city,
    province: dto.province,
    highestQualification: dto.highestQualification,
    specialization: dto.specialization,
    yearsTeachingExperience: dto.yearsTeachingExperience,
    yearsMarkingExperience: dto.yearsMarkingExperience,
    subjectIds: dto.subjectIds,
    levelIds: dto.levelIds,
    documents: dto.documents,
    declarationAccepted: dto.declarationAccepted,
    status: 'pending',
    addedBy: dto.addedBy,
    createdAt: now,
    updatedAt: now,
    ...(dto.alternatePhone ? { alternatePhone: dto.alternatePhone } : {}),
    ...(dto.district ? { district: dto.district } : {}),
    ...(dto.designation ? { designation: dto.designation } : {}),
    ...(dto.currentEmployer ? { currentEmployer: dto.currentEmployer } : {}),
    ...(dto.dailyCapacity !== undefined ? { dailyCapacity: dto.dailyCapacity } : {}),
    ...(dto.addedByInstituteId ? { addedByInstituteId: dto.addedByInstituteId } : {}),
  };
  checkers.push(checker);
  return checker;
}

export function updateChecker(id: string, dto: UpdateCheckerDto): Checker | undefined {
  const checker = getChecker(id);
  if (!checker) return undefined;
  Object.assign(checker, dto);
  if (checker.checkerType === 'general') delete checker.instituteId;
  checker.updatedAt = new Date().toISOString();
  return checker;
}

/**
 * Approve a pending checker — and create their Evaluator login in the same step, so an
 * approved checker can actually sign in and an unapproved one has no account at all.
 * A school-specific checker's user is bound to the same institute.
 */
export function approveChecker(id: string): Checker | undefined {
  const checker = getChecker(id);
  if (!checker) return undefined;

  if (!checker.userId) {
    const user = createUser({
      email: checker.email,
      fullName: checker.fullName,
      roleId: SYSTEM_ROLE_IDS.checker,
      ...(checker.instituteId ? { instituteId: checker.instituteId } : {}),
    });
    checker.userId = user.id;
  }

  checker.status = 'approved';
  delete checker.rejectionReason;
  const now = new Date().toISOString();
  checker.approvedAt = now;
  checker.updatedAt = now;
  return checker;
}

/** Reject a pending checker, recording why so the adder can correct and resubmit. */
export function rejectChecker(id: string, reason?: string): Checker | undefined {
  const checker = getChecker(id);
  if (!checker) return undefined;
  checker.status = 'rejected';
  if (reason && reason.trim().length > 0) checker.rejectionReason = reason.trim();
  checker.updatedAt = new Date().toISOString();
  return checker;
}

/** Human label for a status, shared by the list and the approvals queue. */
export const CHECKER_STATUS_LABEL: Record<CheckerStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};
