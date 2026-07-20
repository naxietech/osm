/**
 * Mock exam service (frontend only). CRUD over the shared in-memory store, plus the
 * board-side lifecycle actions (open / close registration, assign roll numbers).
 * Mirrors authService: async with simulated latency, exported as a single object.
 * TODO: Replace with real examsApi calls via api-client against the backend.
 */
import {
  type CreateExamDto,
  type CreateExamPaperDto,
  type Exam,
  type ExamListItem,
  type ExamPaper,
  ExamStatus,
  InstituteLevel,
  type UpdateExamDto,
} from '@oses/types';

import { levelOrdinal } from './academic.service';
import { exams, findExam, nextId, registrations, toExamListItem } from './mock-store';

/** Secondary covers ordinals ≤10; higher secondary covers 11–12. */
function instituteLevelForOrdinal(ordinal: number): InstituteLevel {
  return ordinal <= 10 ? InstituteLevel.SECONDARY : InstituteLevel.HIGHER_SECONDARY;
}

const LATENCY = 400;
function delay<T>(value: T): Promise<T> {
  return new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY));
}

/** Turn paper DTOs into stored papers with generated ids. */
function materializePapers(examId: string, papers: CreateExamPaperDto[]): ExamPaper[] {
  return papers.map((p) => ({
    id: nextId('pap'),
    examId,
    subject: p.subject,
    totalMarks: p.totalMarks,
    paperDate: p.paperDate,
    paperType: p.paperType,
  }));
}

function listExams(): Promise<ExamListItem[]> {
  return delay(exams.map(toExamListItem));
}

function getExam(id: string): Promise<Exam | undefined> {
  return delay(findExam(id));
}

function createExam(dto: CreateExamDto): Promise<Exam> {
  const id = nextId('exam');
  const classNumber = levelOrdinal(dto.levelId);
  const exam: Exam = {
    id,
    code: dto.code,
    name: dto.name,
    session: dto.session,
    instituteLevel: instituteLevelForOrdinal(classNumber),
    levelId: dto.levelId,
    groupId: dto.groupId,
    classNumber,
    instituteScope: dto.instituteScope,
    ...(dto.instituteScope === 'selected' && dto.instituteIds
      ? { instituteIds: dto.instituteIds }
      : {}),
    ...(dto.subgroupId ? { subgroupId: dto.subgroupId } : {}),
    ...(dto.subjectIds ? { subjectIds: dto.subjectIds } : {}),
    ...(dto.shift ? { shift: dto.shift } : {}),
    ...(dto.examCompletedDate ? { examCompletedDate: dto.examCompletedDate } : {}),
    registrationOpensAt: dto.registrationOpensAt,
    registrationClosesAt: dto.registrationClosesAt,
    status: ExamStatus.DRAFT,
    papers: materializePapers(id, dto.papers),
    createdAt: new Date().toISOString(),
  };
  exams.push(exam);
  return delay(exam);
}

function updateExam(id: string, dto: UpdateExamDto): Promise<Exam> {
  const exam = findExam(id);
  if (!exam) return Promise.reject(new Error('Exam not found'));

  if (dto.name !== undefined) exam.name = dto.name;
  if (dto.session !== undefined) exam.session = dto.session;
  if (dto.levelId !== undefined) {
    exam.levelId = dto.levelId;
    exam.classNumber = levelOrdinal(dto.levelId);
    exam.instituteLevel = instituteLevelForOrdinal(exam.classNumber);
  }
  if (dto.groupId !== undefined) exam.groupId = dto.groupId;
  if (dto.subgroupId !== undefined) exam.subgroupId = dto.subgroupId;
  if (dto.subjectIds !== undefined) exam.subjectIds = dto.subjectIds;
  if (dto.shift !== undefined) exam.shift = dto.shift;
  if (dto.examCompletedDate !== undefined) exam.examCompletedDate = dto.examCompletedDate;
  if (dto.instituteScope !== undefined) {
    exam.instituteScope = dto.instituteScope;
    if (dto.instituteScope === 'all') delete exam.instituteIds;
    else if (dto.instituteIds !== undefined) exam.instituteIds = dto.instituteIds;
  } else if (dto.instituteIds !== undefined) {
    exam.instituteIds = dto.instituteIds;
  }
  if (dto.registrationOpensAt !== undefined) exam.registrationOpensAt = dto.registrationOpensAt;
  if (dto.registrationClosesAt !== undefined) exam.registrationClosesAt = dto.registrationClosesAt;
  if (dto.status !== undefined) exam.status = dto.status;
  if (dto.papers !== undefined) exam.papers = materializePapers(id, dto.papers);

  return delay(exam);
}

function setStatus(id: string, status: ExamStatus): Promise<Exam> {
  const exam = findExam(id);
  if (!exam) return Promise.reject(new Error('Exam not found'));
  exam.status = status;
  return delay(exam);
}

/**
 * Board action once the window closes: give every candidate a sequential roll number
 * (order of registration), confirm them, and mark the exam registration-closed.
 */
function assignRollNumbers(examId: string): Promise<Exam> {
  const exam = findExam(examId);
  if (!exam) return Promise.reject(new Error('Exam not found'));

  const yy = exam.registrationClosesAt.slice(2, 4); // 'YY' of the exam year
  const candidates = registrations
    .filter((r) => r.examId === examId && r.status !== 'withdrawn')
    // block by school (consecutive serials per school), then by registration order
    .sort(
      (a, b) =>
        a.instituteId.localeCompare(b.instituteId) || a.registeredAt.localeCompare(b.registeredAt),
    );

  candidates.forEach((reg, index) => {
    if (!reg.rollNumber) {
      // 8-digit, number-only: YY + 6-digit serial (never repeats across years)
      reg.rollNumber = `${yy}${String(index + 1).padStart(6, '0')}`;
    }
    reg.status = 'confirmed';
  });

  exam.status = ExamStatus.REGISTRATION_CLOSED;
  return delay(exam);
}

export const examService = {
  listExams,
  getExam,
  createExam,
  updateExam,
  setStatus,
  assignRollNumbers,
};
