/**
 * SLO — Student Learning Outcome. A single statement of what a student should be able
 * to do (e.g. "Explain the structure of a cell"). Every SLO is **class-specific and
 * subject-specific**: it belongs to one class (level) + one subject. Managed by the
 * super admin. Later phases tag questions with SLOs and report performance per SLO.
 */
export interface Slo {
  id: string;
  classId: string; // Level id (Class 9, Class 10, …)
  subjectId: string;
  code: string; // short reference, e.g. "9-BIO-1.1"
  name: string; // short title
  description?: string; // the full outcome statement
  isActive: boolean;
}

export interface CreateSloDto {
  classId: string;
  subjectId: string;
  code: string;
  name: string;
  description?: string;
}

export interface UpdateSloDto {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}
