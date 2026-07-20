/**
 * Checkers (evaluators / paper markers).
 *
 * A checker is added EITHER by an institute — in which case the record is bound to that
 * institute and cannot name another one — OR by the super admin, who may additionally
 * create a `general` checker bound to no institute at all. Both paths land as PENDING
 * in the super admin's approval queue; approving is what creates the Evaluator login.
 *
 * PII WARNING: `cnic`, `dateOfBirth`, `mobile` and `address` are PII. They exist so the
 * approver can verify credibility and must not be surfaced to other checkers.
 */
import type { Province } from './institute.types';
import type { Gender } from './student.types';

/**
 * `school-specific` — may only ever mark that institute's papers.
 * `general` — not bound to an institute; markable across the board.
 */
export type CheckerType = 'general' | 'school-specific';

/** Approval lifecycle. Rejected records keep their reason so the adder can correct them. */
export type CheckerStatus = 'pending' | 'approved' | 'rejected';

/** Which supporting document an upload represents. */
export type CheckerDocumentKind = 'qualification' | 'cnic' | 'nomination';

export interface CheckerDocument {
  kind: CheckerDocumentKind;
  /** Frontend-only for now: the picked file's name. Real storage lands with the backend. */
  fileName: string;
}

/** Who created the record — drives whether the institute binding was forced. */
export type CheckerAddedBy = 'institute' | 'super-admin';

export interface Checker {
  id: string;
  /** Stable public reference, safe to show without exposing identity. */
  checkerRefId: string;

  // ---- classification ----
  checkerType: CheckerType;
  /** Required when `checkerType` is 'school-specific'; absent for a general checker. */
  instituteId?: string;

  // ---- personal (PII) ----
  fullName: string;
  fatherOrGuardianName: string;
  cnic: string;
  gender: Gender;
  dateOfBirth: string;

  // ---- contact (PII) ----
  email: string;
  mobile: string;
  alternatePhone?: string;
  address: string;
  city: string;
  district?: string;
  province: Province;

  // ---- professional / qualification ----
  highestQualification: string;
  specialization: string;
  designation?: string;
  currentEmployer?: string;
  yearsTeachingExperience: number;
  yearsMarkingExperience: number;

  // ---- marking scope ----
  subjectIds: string[];
  levelIds: string[];
  /** Scripts the checker expects to mark per day; used for allocation planning. */
  dailyCapacity?: number;

  // ---- vetting ----
  documents: CheckerDocument[];
  /** Confidentiality + marking-guidelines agreement; must be true to submit. */
  declarationAccepted: boolean;

  // ---- lifecycle ----
  status: CheckerStatus;
  rejectionReason?: string;
  addedBy: CheckerAddedBy;
  /** The institute whose user created the record (set when `addedBy` is 'institute'). */
  addedByInstituteId?: string;
  /** The Evaluator user created on approval — absent until approved. */
  userId?: string;
  approvedAt?: string;

  createdAt: string;
  updatedAt: string;
}

/** Row shape for the checkers table — no CNIC / DOB / address. */
export interface CheckerListItem {
  id: string;
  checkerRefId: string;
  fullName: string;
  checkerType: CheckerType;
  instituteId?: string;
  subjectIds: string[];
  status: CheckerStatus;
  yearsMarkingExperience: number;
}

export interface CreateCheckerDto {
  checkerType: CheckerType;
  instituteId?: string;

  fullName: string;
  fatherOrGuardianName: string;
  cnic: string;
  gender: Gender;
  dateOfBirth: string;

  email: string;
  mobile: string;
  alternatePhone?: string;
  address: string;
  city: string;
  district?: string;
  province: Province;

  highestQualification: string;
  specialization: string;
  designation?: string;
  currentEmployer?: string;
  yearsTeachingExperience: number;
  yearsMarkingExperience: number;

  subjectIds: string[];
  levelIds: string[];
  dailyCapacity?: number;

  documents: CheckerDocument[];
  declarationAccepted: boolean;

  addedBy: CheckerAddedBy;
  addedByInstituteId?: string;
}

export type UpdateCheckerDto = Partial<Omit<CreateCheckerDto, 'addedBy' | 'addedByInstituteId'>>;
