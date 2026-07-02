import { describe, expect, it } from 'vitest';

import { ExamStatus, SchoolLevel } from '@oses/types';

import { examService } from './exam.service';

describe('examService', () => {
  it('lists seeded exams with paper and candidate counts', async () => {
    const list = await examService.listExams();
    expect(list.length).toBeGreaterThanOrEqual(3);

    const open = list.find((e) => e.id === 'exam_open');
    expect(open?.paperCount).toBe(4);
    expect(open?.candidateCount).toBe(0);

    const closed = list.find((e) => e.id === 'exam_closed');
    expect(closed?.candidateCount).toBe(2); // two seeded candidates
  });

  it('returns a full exam with its papers, or undefined for an unknown id', async () => {
    const exam = await examService.getExam('exam_open');
    expect(exam?.gradeId).toBe(10);
    expect(exam?.papers.some((p) => p.paperType === 'elective')).toBe(true);

    expect(await examService.getExam('nope')).toBeUndefined();
  });

  it('creates a draft exam and assigns ids to its papers', async () => {
    const created = await examService.createExam({
      code: 'G11-ANN-2026',
      name: 'Grade 11 Annual Examination',
      session: 'Annual 2026',
      schoolLevel: SchoolLevel.HIGHER_SECONDARY,
      gradeId: 11,
      registrationOpensAt: '2026-06-15',
      registrationClosesAt: '2026-07-31',
      papers: [
        { subject: 'Physics', totalMarks: 75, paperDate: '2026-08-10', paperType: 'compulsory' },
        {
          subject: 'Biology',
          totalMarks: 75,
          paperDate: '2026-08-12',
          paperType: 'elective',
        },
      ],
    });

    expect(created.status).toBe(ExamStatus.DRAFT);
    expect(created.id).toMatch(/^exam_/);
    expect(created.papers).toHaveLength(2);
    expect(created.papers.every((p) => p.id.length > 0 && p.examId === created.id)).toBe(true);

    const list = await examService.listExams();
    expect(list.some((e) => e.id === created.id)).toBe(true);
  });

  it('updates an exam status', async () => {
    const updated = await examService.setStatus('exam_draft', ExamStatus.REGISTRATION_OPEN);
    expect(updated.status).toBe(ExamStatus.REGISTRATION_OPEN);
  });
});
