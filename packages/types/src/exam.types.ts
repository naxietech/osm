import type { InstituteLevel } from './institute.types';

/**
 * Exam domain — two levels:
 *   Exam    = the session a student registers into once (e.g. "Class 10 · Annual 2026").
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

/**
 * Who can register into an exam:
 *   all      — every institute (national exam)
 *   selected — only the institutes listed in `instituteIds` (one or several)
 * The class (level + group) still binds the exam; this only widens/narrows which
 * institutes may register their eligible students.
 */
export type ExamInstituteScope = 'all' | 'selected';

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
  name: string; // display name, e.g. "Class 10 Annual Examination"
  session: string; // e.g. "Annual 2026"
  instituteLevel: InstituteLevel;
  levelId: string; // configurable Level (Class / Year / Semester)
  groupId: string; // Group / stream / program
  classNumber: number; // derived display value = the level's ordinal
  instituteScope: ExamInstituteScope;
  instituteIds?: string[]; // targeted institutes when scope === 'selected'
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
  levelId: string;
  groupId: string;
  classNumber: number;
  instituteScope: ExamInstituteScope;
  instituteIds?: string[];
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
  levelId: string;
  groupId: string;
  instituteScope: ExamInstituteScope;
  instituteIds?: string[];
  registrationOpensAt: string;
  registrationClosesAt: string;
  papers: CreateExamPaperDto[];
}

export interface UpdateExamDto {
  name?: string;
  session?: string;
  levelId?: string;
  groupId?: string;
  instituteScope?: ExamInstituteScope;
  instituteIds?: string[];
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  status?: ExamStatus;
  papers?: CreateExamPaperDto[];
}
