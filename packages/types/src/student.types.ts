/**
 * IMPORTANT — PII WARNING:
 * fullName, fatherOrGuardianName, cnicOrBform, fatherOrGuardianCnic,
 * dateOfBirth, fatherMobile, studentMobile, address, postalAddress and photoUrl
 * are PII fields. They must NEVER appear in evaluator-facing API responses.
 * Use SafeStudentRef when returning student data to EVALUATOR role.
 * Use StudentListItem for admin list views (omits all document / contact PII).
 * Only controllers and admins may receive the full Student type.
 */
export type Gender = 'male' | 'female' | 'other';
export type EnrollmentStatus = 'active' | 'inactive' | 'transferred' | 'graduated';

export interface Student {
  id: string;
  studentRefId: string; // UUID — the only identifier exposed to the exam schema
  schoolId: string;

  // Identity (PII)
  fullName: string;
  fatherOrGuardianName: string;
  gender: Gender;
  dateOfBirth: string; // YYYY-MM-DD
  photoUrl?: string; // stored photo reference (assigned server-side after upload)

  // Identity documents (PII)
  cnicOrBform?: string; // student's CNIC or B-Form — minors may not have one yet
  fatherOrGuardianCnic: string;

  // Contact (PII)
  fatherMobile: string;
  studentMobile?: string;

  // Address
  address: string; // residential / street address (PII)
  city: string;
  district: string;
  postalAddress?: string; // mailing address, only if different from residential (PII)

  // Enrollment
  gradeId: number;
  enrollmentStatus: EnrollmentStatus;
  createdAt: string;
}

// Safe for evaluator contexts — no PII whatsoever
export interface SafeStudentRef {
  studentRefId: string;
  gradeId: number;
}

// Safe for admin list views — no document / contact / address PII
export interface StudentListItem {
  id: string;
  studentRefId: string;
  fullName: string;
  gradeId: number;
  enrollmentStatus: EnrollmentStatus;
}

export interface CreateStudentDto {
  schoolId: string;
  fullName: string;
  fatherOrGuardianName: string;
  gender: Gender;
  dateOfBirth: string;
  photoUrl?: string;
  cnicOrBform?: string;
  fatherOrGuardianCnic: string;
  fatherMobile: string;
  studentMobile?: string;
  address: string;
  city: string;
  district: string;
  postalAddress?: string;
  gradeId: number;
}

export interface UpdateStudentDto {
  fullName?: string;
  fatherOrGuardianName?: string;
  gender?: Gender;
  dateOfBirth?: string;
  photoUrl?: string;
  cnicOrBform?: string;
  fatherOrGuardianCnic?: string;
  fatherMobile?: string;
  studentMobile?: string;
  address?: string;
  city?: string;
  district?: string;
  postalAddress?: string;
  gradeId?: number;
  enrollmentStatus?: EnrollmentStatus;
}
