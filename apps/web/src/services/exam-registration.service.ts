/**
 * Mock exam-registration service (frontend only). The school-facing side: list the
 * open exams, list a school's eligible students for an exam, register a class in
 * bulk, and read back candidate lists / a student's registration history.
 * Mirrors authService: async with simulated latency, exported as a single object.
 * TODO: Replace with real registrationsApi calls via api-client against the backend.
 */
import {
  type CandidateListItem,
  type CreateExamRegistrationDto,
  type Exam,
  type ExamListItem,
  type ExamRegistration,
  ExamStatus,
  type StudentExamHistoryItem,
} from '@oses/types';

import {
  type StoredStudent,
  exams,
  findExam,
  findStudentByRef,
  nextId,
  registrations,
  students,
  toExamListItem,
} from './mock-store';

const LATENCY = 400;
function delay<T>(value: T): Promise<T> {
  return new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY));
}

/** studentRefIds already registered (non-withdrawn) for an exam. */
function registeredRefs(examId: string): Set<string> {
  return new Set(
    registrations
      .filter((r) => r.examId === examId && r.status !== 'withdrawn')
      .map((r) => r.studentRefId),
  );
}

/** Resolve chosen elective paper ids to their subject names for display. */
function resolveElectiveSubjects(exam: Exam, electivePaperIds: string[]): string[] {
  return electivePaperIds
    .map((pid) => exam.papers.find((p) => p.id === pid)?.subject)
    .filter((s): s is string => Boolean(s));
}

/** Exams a school can register into right now (registration window open). */
function listOpenExams(): Promise<ExamListItem[]> {
  const open = exams.filter((e) => e.status === ExamStatus.REGISTRATION_OPEN);
  return delay(open.map(toExamListItem));
}

/** A school-facing exam row: the exam plus this school's own registered count. */
export interface SchoolExamRow {
  exam: ExamListItem;
  /** This school's registered (non-withdrawn) candidates for the exam. */
  registeredCount: number;
  /** Whether the school can still register into it (window open). */
  canRegister: boolean;
}

/**
 * Exams relevant to a school: ones open for registration, plus any it has already
 * registered candidates into (so its candidates stay visible after the window closes).
 */
function listSchoolExams(schoolId: string): Promise<SchoolExamRow[]> {
  const schoolCount = (examId: string): number =>
    registrations.filter(
      (r) => r.examId === examId && r.schoolId === schoolId && r.status !== 'withdrawn',
    ).length;

  const rows = exams
    .filter((e) => e.status === ExamStatus.REGISTRATION_OPEN || schoolCount(e.id) > 0)
    .map((e) => ({
      exam: toExamListItem(e),
      registeredCount: schoolCount(e.id),
      canRegister: e.status === ExamStatus.REGISTRATION_OPEN,
    }));

  return delay(rows);
}

/**
 * A school's students eligible for an exam: same grade, active, own school, and not
 * already registered. This is the source for the bulk register (candidate-picker).
 */
function listRegisterableStudents(examId: string, schoolId: string): Promise<StoredStudent[]> {
  const exam = findExam(examId);
  if (!exam) return delay<StoredStudent[]>([]);
  const already = registeredRefs(examId);
  const eligible = students.filter(
    (s) =>
      s.schoolId === schoolId &&
      s.gradeId === exam.gradeId &&
      s.enrollmentStatus === 'active' &&
      !already.has(s.studentRefId),
  );
  return delay(eligible);
}

/** Register a class in one submit; each candidate carries its own elective choices. */
function registerStudents(dto: CreateExamRegistrationDto): Promise<ExamRegistration[]> {
  const exam = findExam(dto.examId);
  // Registration is only allowed while the window is open.
  if (!exam || exam.status !== ExamStatus.REGISTRATION_OPEN) {
    return delay<ExamRegistration[]>([]);
  }

  const already = registeredRefs(dto.examId);
  const created: ExamRegistration[] = [];

  for (const candidate of dto.candidates) {
    const student = findStudentByRef(candidate.studentRefId);
    if (!student || already.has(candidate.studentRefId)) continue;

    const registration: ExamRegistration = {
      id: nextId('reg'),
      examId: dto.examId,
      studentRefId: candidate.studentRefId,
      schoolId: student.schoolId,
      electivePaperIds: candidate.electivePaperIds,
      status: 'pending',
      registeredAt: new Date().toISOString(),
    };
    registrations.push(registration);
    already.add(candidate.studentRefId);
    created.push(registration);
  }

  return delay(created);
}

/** Project a registration onto a candidate row (resolves student + elective names). */
function toCandidateRow(exam: Exam, r: ExamRegistration): CandidateListItem {
  const student = findStudentByRef(r.studentRefId);
  const item: CandidateListItem = {
    registrationId: r.id,
    studentRefId: r.studentRefId,
    gradeId: student?.gradeId ?? exam.gradeId,
    status: r.status,
    electiveSubjects: resolveElectiveSubjects(exam, r.electivePaperIds),
  };
  if (student?.fullName) item.fullName = student.fullName;
  if (r.rollNumber) item.rollNumber = r.rollNumber;
  return item;
}

/** Candidate list for an exam (admin / controller — every school; includes names). */
function listCandidates(examId: string): Promise<CandidateListItem[]> {
  const exam = findExam(examId);
  if (!exam) return delay<CandidateListItem[]>([]);
  const rows = registrations
    .filter((r) => r.examId === examId && r.status !== 'withdrawn')
    .map((r) => toCandidateRow(exam, r));
  return delay(rows);
}

/** Candidate list for one school only — the school's own registered candidates. */
function listCandidatesForSchool(examId: string, schoolId: string): Promise<CandidateListItem[]> {
  const exam = findExam(examId);
  if (!exam) return delay<CandidateListItem[]>([]);
  const rows = registrations
    .filter((r) => r.examId === examId && r.schoolId === schoolId && r.status !== 'withdrawn')
    .map((r) => toCandidateRow(exam, r));
  return delay(rows);
}

/** A single student's registrations across exams — the profile history trail. */
function getStudentHistory(studentRefId: string): Promise<StudentExamHistoryItem[]> {
  const rows = registrations
    .filter((r) => r.studentRefId === studentRefId && r.status !== 'withdrawn')
    .map((r) => {
      const exam = findExam(r.examId);
      const item: StudentExamHistoryItem = {
        registrationId: r.id,
        examId: r.examId,
        examName: exam?.name ?? 'Exam',
        session: exam?.session ?? '',
        gradeId: exam?.gradeId ?? 0,
        status: r.status,
      };
      if (r.rollNumber) item.rollNumber = r.rollNumber;
      return item;
    });

  return delay(rows);
}

export const examRegistrationService = {
  listOpenExams,
  listSchoolExams,
  listRegisterableStudents,
  registerStudents,
  listCandidates,
  listCandidatesForSchool,
  getStudentHistory,
};
