import { describe, expect, it } from 'vitest';

import { ExamStatus } from '@oses/types';

import { examRegistrationService } from './exam-registration.service';
import { examService } from './exam.service';

describe('examRegistrationService', () => {
  it('lists only exams whose registration window is open', async () => {
    const open = await examRegistrationService.listOpenExams();
    expect(open.map((e) => e.id)).toContain('exam_open');
    expect(open.map((e) => e.id)).not.toContain('exam_draft'); // draft
    expect(open.map((e) => e.id)).not.toContain('exam_closed'); // closed
  });

  it("lists a school's eligible students (own school, matching class, active)", async () => {
    const eligible = await examRegistrationService.listRegisterableStudents('exam_open', 'sch_001');
    // class-10, active, sch_001 students only
    expect(eligible.every((s) => s.classNumber === 10 && s.instituteId === 'sch_001')).toBe(true);
    expect(eligible.some((s) => s.enrollmentStatus !== 'active')).toBe(false);
    expect(eligible.map((s) => s.studentRefId)).not.toContain('ref-b20ddee0'); // sch_002
    expect(eligible.map((s) => s.studentRefId)).not.toContain('ref-1a5c8e90'); // class 9
  });

  it('respects institute scope: a selected exam only lets targeted institutes register', async () => {
    const created = await examService.createExam({
      code: 'SCOPE-TEST',
      name: 'Scope Test',
      session: 'Annual 2026',
      levelId: 'lvl_10',
      groupId: 'grp_science',
      instituteScope: 'selected',
      instituteIds: ['sch_002'],
      registrationOpensAt: '2026-06-15',
      registrationClosesAt: '2026-07-31',
      papers: [
        { subject: 'Physics', totalMarks: 65, paperDate: '2026-08-10', paperType: 'compulsory' },
      ],
    });
    await examService.setStatus(created.id, ExamStatus.REGISTRATION_OPEN);

    // sch_001 is NOT targeted → no eligible students, and the exam isn't offered to it
    expect(
      await examRegistrationService.listRegisterableStudents(created.id, 'sch_001'),
    ).toHaveLength(0);
    const sch1Rows = await examRegistrationService.listInstituteExams('sch_001');
    expect(sch1Rows.map((r) => r.exam.id)).not.toContain(created.id);

    // sch_002 IS targeted → its lvl_10 science student is eligible and it can register
    const sch2Eligible = await examRegistrationService.listRegisterableStudents(
      created.id,
      'sch_002',
    );
    expect(sch2Eligible.map((s) => s.studentRefId)).toContain('ref-b20ddee0');
    const sch2Row = (await examRegistrationService.listInstituteExams('sch_002')).find(
      (r) => r.exam.id === created.id,
    );
    expect(sch2Row?.canRegister).toBe(true);
  });

  it('reads seeded candidates with 8-digit roll numbers', async () => {
    const candidates = await examRegistrationService.listCandidates('exam_closed');
    expect(candidates).toHaveLength(2);
    expect(
      candidates.every((c) => c.status === 'confirmed' && /^\d{8}$/.test(c.rollNumber ?? '')),
    ).toBe(true);
    const fatima = candidates.find((c) => c.studentRefId === 'ref-9b2e7d44');
    expect(fatima?.fullName).toBe('Fatima Noor');
    expect(fatima?.electiveSubjects).toHaveLength(0); // Pre-Medical is all compulsory
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
