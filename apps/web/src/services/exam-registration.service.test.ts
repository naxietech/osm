import { describe, expect, it } from 'vitest';

import { examRegistrationService } from './exam-registration.service';
import { examService } from './exam.service';

describe('examRegistrationService', () => {
  it('lists only exams whose registration window is open', async () => {
    const open = await examRegistrationService.listOpenExams();
    expect(open.map((e) => e.id)).toContain('exam_open');
    expect(open.map((e) => e.id)).not.toContain('exam_draft'); // draft
    expect(open.map((e) => e.id)).not.toContain('exam_closed'); // closed
  });

  it("lists a school's eligible students (own school, matching grade, active)", async () => {
    const eligible = await examRegistrationService.listRegisterableStudents('exam_open', 'sch_001');
    // grade-10, active, sch_001 students only
    expect(eligible.every((s) => s.gradeId === 10 && s.schoolId === 'sch_001')).toBe(true);
    expect(eligible.some((s) => s.enrollmentStatus !== 'active')).toBe(false);
    expect(eligible.map((s) => s.studentRefId)).not.toContain('ref-b20ddee0'); // sch_002
    expect(eligible.map((s) => s.studentRefId)).not.toContain('ref-1a5c8e90'); // grade 9
  });

  it('reads seeded candidates with roll numbers and elective subjects', async () => {
    const candidates = await examRegistrationService.listCandidates('exam_closed');
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.status === 'confirmed' && Boolean(c.rollNumber))).toBe(true);
    const fatima = candidates.find((c) => c.studentRefId === 'ref-9b2e7d44');
    expect(fatima?.fullName).toBe('Fatima Noor');
    expect(fatima?.electiveSubjects).toContain('Biology');
  });

  it("returns a student's registration history", async () => {
    const history = await examRegistrationService.getStudentHistory('ref-9b2e7d44');
    expect(history.some((h) => h.examId === 'exam_closed' && Boolean(h.rollNumber))).toBe(true);
  });

  it('registers a class in bulk with multiple electives, scoped per school, then assigns roll numbers', async () => {
    const before = await examRegistrationService.listRegisterableStudents('exam_open', 'sch_001');
    const picked = before.slice(0, 2);
    expect(picked).toHaveLength(2);

    // each candidate takes BOTH elective papers (multi-select)
    await examRegistrationService.registerStudents({
      examId: 'exam_open',
      candidates: picked.map((s) => ({
        studentRefId: s.studentRefId,
        electivePaperIds: ['pap_o3', 'pap_o4'],
      })),
    });

    // now candidates, pending, with both electives resolved
    const candidates = await examRegistrationService.listCandidates('exam_open');
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.status === 'pending')).toBe(true);
    expect(candidates[0]?.electiveSubjects).toEqual(
      expect.arrayContaining(['Biology', 'Computer Science']),
    );

    // school-scoped candidate list: sch_001 sees its two, sch_002 sees none
    expect(
      await examRegistrationService.listCandidatesForSchool('exam_open', 'sch_001'),
    ).toHaveLength(2);
    expect(
      await examRegistrationService.listCandidatesForSchool('exam_open', 'sch_002'),
    ).toHaveLength(0);

    // eligibility shrinks — the two are no longer registerable
    const after = await examRegistrationService.listRegisterableStudents('exam_open', 'sch_001');
    expect(after).toHaveLength(before.length - 2);

    // board assigns roll numbers → confirmed + exam closed
    await examService.assignRollNumbers('exam_open');
    const confirmed = await examRegistrationService.listCandidates('exam_open');
    expect(confirmed.every((c) => c.status === 'confirmed' && Boolean(c.rollNumber))).toBe(true);
  });
});
