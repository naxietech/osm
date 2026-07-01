import type { SchoolLevel } from './school.types';

/**
 * Exam domain — two levels:
 *   Exam    = the session a student registers into once (e.g. "Grade 10 · Annual 2026").
 *             Carries one registration window and, once closed, one roll number per candidate.
 *   ExamPaper = a subject paper that sits under an exam. This is what gets marked and
 *             where total marks live. Papers are compulsory (everyone sits them) or
 *             elective (a candidate may choose any number of them).
 *
 * Students never appear here directly; the link is ExamRegistration (see exam-registration.types).
 */

/** Lifecycle of an exam session; drives what schools and the board can do. */
export enum ExamStatus {
  DRAFT = 'draft', // being set up; not visible to schools
  REGISTRATION_OPEN = 'registration_open', // schools can register candidates
  REGISTRATION_CLOSED = 'registration_closed', // window closed; roll numbers assignable
  IN_PROGRESS = 'in_progress', // papers being sat / marked
  COMPLETED = 'completed', // results declared
}

/** Whether a paper is sat by everyone (compulsory) or optionally chosen (elective). */
export type ExamPaperType = 'compulsory' | 'elective';

export interface ExamPaper {
  id: string;
  examId: string;
  subject: string;
  totalMarks: number;
  paperDate: string; // YYYY-MM-DD
  paperType: ExamPaperType;
}

export interface Exam {
  id: string;
  code: string; // unique human code, e.g. "G10-ANN-2026"
  name: string; // display name, e.g. "Grade 10 Annual Examination"
  session: string; // e.g. "Annual 2026"
  schoolLevel: SchoolLevel;
  gradeId: number; // 9, 10, 11 or 12
  registrationOpensAt: string; // YYYY-MM-DD
  registrationClosesAt: string; // YYYY-MM-DD
  status: ExamStatus;
  papers: ExamPaper[];
  createdAt: string;
}

/** List/table view — no nested papers; counts are precomputed. */
export interface ExamListItem {
  id: string;
  code: string;
  name: string;
  session: string;
  gradeId: number;
  status: ExamStatus;
  paperCount: number;
  candidateCount: number;
  registrationOpensAt: string;
  registrationClosesAt: string;
}

/** Paper payload when creating/editing an exam (id + examId assigned server-side). */
export interface CreateExamPaperDto {
  subject: string;
  totalMarks: number;
  paperDate: string;
  paperType: ExamPaperType;
}

export interface CreateExamDto {
  code: string;
  name: string;
  session: string;
  schoolLevel: SchoolLevel;
  gradeId: number;
  registrationOpensAt: string;
  registrationClosesAt: string;
  papers: CreateExamPaperDto[];
}

export interface UpdateExamDto {
  name?: string;
  session?: string;
  schoolLevel?: SchoolLevel;
  gradeId?: number;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  status?: ExamStatus;
  papers?: CreateExamPaperDto[];
}
