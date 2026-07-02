/**
 * In-memory mock store for the exam-registration flow (frontend only, no backend).
 *
 * Unlike the per-page MOCK_* constants used elsewhere, this store is shared and
 * mutable so registrations created on one screen are visible on another within a
 * session. Data resets on page refresh. Seeded to line up with the existing mock
 * schools (sch_001…) and students so the whole flow is coherent out of the box.
 *
 * TODO: Replace with real services (examsApi / registrationsApi) against the backend.
 */
import {
  type Exam,
  type ExamListItem,
  type ExamPaper,
  type ExamRegistration,
  ExamStatus,
  SchoolLevel,
  type StudentListItem,
} from '@oses/types';

/** Student fields the exam flow needs — StudentListItem plus its owning school. */
export type StoredStudent = StudentListItem & { schoolId: string };

let idCounter = 5000;
/** Monotonic id generator for runtime-created records (seed ids are hand-authored). */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

// ---- seed students (sch_001 unless noted) --------------------------------------
export const students: StoredStudent[] = [
  {
    id: 'stu_001',
    studentRefId: 'ref-3f8a1c20',
    fullName: 'Ali Hassan',
    gradeId: 10,
    enrollmentStatus: 'active',
    schoolId: 'sch_001',
  },
  {
    id: 'stu_003',
    studentRefId: 'ref-1a5c8e90',
    fullName: 'Bilal Ahmed',
    gradeId: 9,
    enrollmentStatus: 'inactive',
    schoolId: 'sch_001',
  },
  {
    id: 'stu_002',
    studentRefId: 'ref-9b2e7d44',
    fullName: 'Fatima Noor',
    gradeId: 12,
    enrollmentStatus: 'active',
    schoolId: 'sch_001',
  },
  {
    id: 'stu_010',
    studentRefId: 'ref-a10c1122',
    fullName: 'Ayesha Siddiqui',
    gradeId: 10,
    enrollmentStatus: 'active',
    schoolId: 'sch_001',
  },
  {
    id: 'stu_011',
    studentRefId: 'ref-a11d3344',
    fullName: 'Usman Ali',
    gradeId: 10,
    enrollmentStatus: 'active',
    schoolId: 'sch_001',
  },
  {
    id: 'stu_012',
    studentRefId: 'ref-a12e5566',
    fullName: 'Hina Tariq',
    gradeId: 10,
    enrollmentStatus: 'active',
    schoolId: 'sch_001',
  },
  {
    id: 'stu_013',
    studentRefId: 'ref-a13f7788',
    fullName: 'Zain Malik',
    gradeId: 10,
    enrollmentStatus: 'active',
    schoolId: 'sch_001',
  },
  {
    id: 'stu_014',
    studentRefId: 'ref-a1409900',
    fullName: 'Sara Yousaf',
    gradeId: 10,
    enrollmentStatus: 'active',
    schoolId: 'sch_001',
  },
  {
    id: 'stu_030',
    studentRefId: 'ref-c30aabbc',
    fullName: 'Nida Farooq',
    gradeId: 12,
    enrollmentStatus: 'active',
    schoolId: 'sch_001',
  },
  // a Karachi student, to prove school scoping in the register screen
  {
    id: 'stu_020',
    studentRefId: 'ref-b20ddee0',
    fullName: 'Kamran Khan',
    gradeId: 10,
    enrollmentStatus: 'active',
    schoolId: 'sch_002',
  },
];

// ---- seed exam papers ----------------------------------------------------------
// Grade 10 · Annual 2026 (open)
const openPapers: ExamPaper[] = [
  {
    id: 'pap_o1',
    examId: 'exam_open',
    subject: 'Physics',
    totalMarks: 75,
    paperDate: '2026-08-10',
    paperType: 'compulsory',
  },
  {
    id: 'pap_o2',
    examId: 'exam_open',
    subject: 'Mathematics',
    totalMarks: 100,
    paperDate: '2026-08-12',
    paperType: 'compulsory',
  },
  {
    id: 'pap_o3',
    examId: 'exam_open',
    subject: 'Biology',
    totalMarks: 75,
    paperDate: '2026-08-14',
    paperType: 'elective',
  },
  {
    id: 'pap_o4',
    examId: 'exam_open',
    subject: 'Computer Science',
    totalMarks: 75,
    paperDate: '2026-08-14',
    paperType: 'elective',
  },
];

// Grade 9 · Annual 2026 (draft)
const draftPapers: ExamPaper[] = [
  {
    id: 'pap_d1',
    examId: 'exam_draft',
    subject: 'Physics',
    totalMarks: 60,
    paperDate: '2026-09-01',
    paperType: 'compulsory',
  },
  {
    id: 'pap_d2',
    examId: 'exam_draft',
    subject: 'Mathematics',
    totalMarks: 75,
    paperDate: '2026-09-03',
    paperType: 'compulsory',
  },
];

// Grade 12 · Annual 2025 (registration closed, roll numbers assigned)
const closedPapers: ExamPaper[] = [
  {
    id: 'pap_c1',
    examId: 'exam_closed',
    subject: 'Physics',
    totalMarks: 85,
    paperDate: '2025-08-05',
    paperType: 'compulsory',
  },
  {
    id: 'pap_c2',
    examId: 'exam_closed',
    subject: 'Chemistry',
    totalMarks: 85,
    paperDate: '2025-08-07',
    paperType: 'compulsory',
  },
  {
    id: 'pap_c3',
    examId: 'exam_closed',
    subject: 'Biology',
    totalMarks: 85,
    paperDate: '2025-08-09',
    paperType: 'elective',
  },
  {
    id: 'pap_c4',
    examId: 'exam_closed',
    subject: 'Computer Science',
    totalMarks: 85,
    paperDate: '2025-08-09',
    paperType: 'elective',
  },
];

// ---- seed exams ----------------------------------------------------------------
export const exams: Exam[] = [
  {
    id: 'exam_open',
    code: 'G10-ANN-2026',
    name: 'Grade 10 Annual Examination',
    session: 'Annual 2026',
    schoolLevel: SchoolLevel.SECONDARY,
    gradeId: 10,
    registrationOpensAt: '2026-06-15',
    registrationClosesAt: '2026-07-31',
    status: ExamStatus.REGISTRATION_OPEN,
    papers: openPapers,
    createdAt: '2026-06-10T09:00:00.000Z',
  },
  {
    id: 'exam_draft',
    code: 'G09-ANN-2026',
    name: 'Grade 9 Annual Examination',
    session: 'Annual 2026',
    schoolLevel: SchoolLevel.SECONDARY,
    gradeId: 9,
    registrationOpensAt: '2026-08-01',
    registrationClosesAt: '2026-08-31',
    status: ExamStatus.DRAFT,
    papers: draftPapers,
    createdAt: '2026-06-20T09:00:00.000Z',
  },
  {
    id: 'exam_closed',
    code: 'G12-ANN-2025',
    name: 'Grade 12 Annual Examination',
    session: 'Annual 2025',
    schoolLevel: SchoolLevel.HIGHER_SECONDARY,
    gradeId: 12,
    registrationOpensAt: '2025-06-15',
    registrationClosesAt: '2025-07-15',
    status: ExamStatus.REGISTRATION_CLOSED,
    papers: closedPapers,
    createdAt: '2025-06-10T09:00:00.000Z',
  },
];

// ---- seed registrations (for the closed exam; roll numbers already assigned) ----
export const registrations: ExamRegistration[] = [
  {
    id: 'reg_0001',
    examId: 'exam_closed',
    studentRefId: 'ref-9b2e7d44', // Fatima Noor
    schoolId: 'sch_001',
    rollNumber: 'G12-2025-0001',
    electivePaperIds: ['pap_c3'], // Biology
    status: 'confirmed',
    registeredAt: '2025-07-01T10:00:00.000Z',
  },
  {
    id: 'reg_0002',
    examId: 'exam_closed',
    studentRefId: 'ref-c30aabbc', // Nida Farooq
    schoolId: 'sch_001',
    rollNumber: 'G12-2025-0002',
    electivePaperIds: ['pap_c4'], // Computer Science
    status: 'confirmed',
    registeredAt: '2025-07-01T10:05:00.000Z',
  },
];

/** Lookups shared by the services. */
export function findExam(examId: string): Exam | undefined {
  return exams.find((e) => e.id === examId);
}

export function findStudentByRef(studentRefId: string): StoredStudent | undefined {
  return students.find((s) => s.studentRefId === studentRefId);
}

/** Count of candidates registered for an exam. */
export function candidateCount(examId: string): number {
  return registrations.filter((r) => r.examId === examId && r.status !== 'withdrawn').length;
}

/** Project an exam onto its list/table row (shared by both services). */
export function toExamListItem(exam: Exam): ExamListItem {
  return {
    id: exam.id,
    code: exam.code,
    name: exam.name,
    session: exam.session,
    gradeId: exam.gradeId,
    status: exam.status,
    paperCount: exam.papers.length,
    candidateCount: candidateCount(exam.id),
    registrationOpensAt: exam.registrationOpensAt,
    registrationClosesAt: exam.registrationClosesAt,
  };
}
