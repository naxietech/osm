/**
 * IMPORTANT — PII WARNING:
 * fullName, cnicOrBform, and dateOfBirth are PII fields.
 * They must NEVER appear in evaluator-facing API responses.
 * Use SafeStudentRef when returning student data to EVALUATOR role.
 * Use StudentListItem for admin list views (omits CNIC and DOB).
 * Only controllers and admins may receive the full Student type.
 */
export interface Student {
  id: string;
  studentRefId: string; // UUID — the only identifier exposed to the exam schema
  schoolId: string;
  fullName: string; // PII
  cnicOrBform?: string; // PII
  dateOfBirth?: string; // PII
  gender?: 'male' | 'female' | 'other';
  gradeId: number;
  section?: string;
  enrollmentStatus: 'active' | 'inactive' | 'transferred' | 'graduated';
  createdAt: string;
}

// Safe for evaluator contexts — no PII whatsoever
export interface SafeStudentRef {
  studentRefId: string;
  gradeId: number;
  section?: string;
}

// Safe for admin list views — no CNIC or DOB
export interface StudentListItem {
  id: string;
  studentRefId: string;
  fullName: string;
  gradeId: number;
  section?: string;
  enrollmentStatus: string;
}

export interface CreateStudentDto {
  schoolId: string;
  fullName: string;
  cnicOrBform?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  gradeId: number;
  section?: string;
}

export interface UpdateStudentDto {
  fullName?: string;
  gradeId?: number;
  section?: string;
  enrollmentStatus?: 'active' | 'inactive' | 'transferred' | 'graduated';
}
