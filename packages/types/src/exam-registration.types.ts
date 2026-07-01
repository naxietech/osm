/**
 * Exam registration — the link between a Student and an Exam (session).
 *
 * A student is registered ONCE per exam and becomes a candidate: one row, one roll
 * number. Compulsory papers are implied for every candidate; elective choices are
 * captured per student in `electivePaperIds` (any number of elective papers).
 *
 * PII WARNING: CandidateListItem.fullName is PII. It must be omitted for EVALUATOR
 * contexts — evaluators only ever get the studentRefId + roll number, never the name.
 */

/** Registration lifecycle for a single candidate. */
export type RegistrationStatus = 'pending' | 'confirmed' | 'withdrawn';

export interface ExamRegistration {
  id: string;
  examId: string;
  studentRefId: string; // links to Student.studentRefId (never Student.id)
  schoolId: string;
  /** Assigned by the board after the registration window closes. */
  rollNumber?: string;
  /** Chosen elective papers (any number) — ExamPaper.ids on the exam. */
  electivePaperIds: string[];
  status: RegistrationStatus;
  registeredAt: string; // ISO timestamp
}

/** One candidate row for an exam's candidate list (admin / controller / own-school). */
export interface CandidateListItem {
  registrationId: string;
  studentRefId: string;
  fullName?: string; // PII — omitted for evaluator-facing responses
  gradeId: number;
  rollNumber?: string;
  status: RegistrationStatus;
  /** Resolved elective subject names for display (from the chosen papers). */
  electiveSubjects: string[];
}

/** A single student's selection when a school registers a class in bulk. */
export interface CandidateSelection {
  studentRefId: string;
  electivePaperIds: string[]; // any number of elective papers on the exam
}

/** Bulk registration payload — a whole class registered in one submit. */
export interface CreateExamRegistrationDto {
  examId: string;
  candidates: CandidateSelection[];
}

/** A student's registration across exams — the trail shown on the student profile. */
export interface StudentExamHistoryItem {
  registrationId: string;
  examId: string;
  examName: string;
  session: string;
  gradeId: number;
  rollNumber?: string;
  status: RegistrationStatus;
}
