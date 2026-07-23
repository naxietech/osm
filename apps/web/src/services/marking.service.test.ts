import { describe, expect, it } from 'vitest';

import { type MarkingBatch, type MarkingScript } from '@oses/types';

import { findCheckerByUserId } from './checker.service';
import {
  DEMO_CHECKER_ID,
  batchScopeLabel,
  batchStatus,
  findScript,
  flagScript,
  getBatch,
  getDailyMarkingCounts,
  getWorkloadSummary,
  listBatches,
  listCheckerAnswers,
  listCheckerExams,
  listCheckerSubjects,
  listCompletedBatches,
  listOpenBatches,
  listScripts,
  markScript,
  markingBatches,
  maxMarksFor,
  nextAnswerInSubject,
  nextBatch,
  nextPendingScript,
} from './marking.service';
import { students } from './mock-store';

/** The demo checker's own batches — the seed deliberately also holds another checker's. */
function ownBatches(): MarkingBatch[] {
  return markingBatches.filter((b) => b.checkerId === DEMO_CHECKER_ID);
}

/** Every script assigned to the demo checker. */
function ownScripts(): MarkingScript[] {
  return ownBatches().flatMap((b) => b.scripts);
}

describe('marking.service', () => {
  it('links the signed-in demo Evaluator to the checker the work is seeded against', () => {
    const checker = findCheckerByUserId('usr_evaluator');
    expect(checker?.id).toBe(DEMO_CHECKER_ID);
  });

  // Scoping is the whole point of every query in this module, so the seed must contain
  // work that does NOT belong to the demo checker — otherwise a missing filter passes.
  it('never leaks another checker’s batches into these queries', () => {
    const others = markingBatches.filter((b) => b.checkerId !== DEMO_CHECKER_ID);
    expect(others.length).toBeGreaterThan(0);

    const visible = listBatches(DEMO_CHECKER_ID).map((b) => b.id);
    for (const foreign of others) expect(visible).not.toContain(foreign.id);

    expect(visible).toHaveLength(ownBatches().length);
    expect(listBatches('chk_002').map((b) => b.id)).toEqual(['mbatch_100']);
  });

  // Anonymity is the rule the whole marking flow hangs on, so assert it on the data
  // rather than trusting that no one adds a name field later.
  it('never exposes anything that identifies a candidate', () => {
    const scripts = markingBatches.flatMap((b) => b.scripts);
    const studentRefs = new Set(students.map((s) => s.studentRefId));

    for (const script of scripts) {
      const keys = Object.keys(script);
      expect(keys).not.toContain('fullName');
      expect(keys).not.toContain('cnic');
      expect(keys).not.toContain('dateOfBirth');
      expect(keys).not.toContain('rollNumber');
      // The reference must not be reusable to look a student up.
      expect(studentRefs.has(script.candidateRefId)).toBe(false);
    }
  });

  it('derives batch status from the scripts rather than storing it', () => {
    for (const batch of markingBatches) {
      const settled = batch.scripts.filter((s) => s.status !== 'pending').length;
      const expected =
        settled === 0 ? 'queued' : settled === batch.scripts.length ? 'completed' : 'in-progress';
      expect(batchStatus(batch)).toBe(expected);
    }
  });

  // A batch can be finished without being fully marked: whatever the checker flagged is
  // now the supervisor's problem. It must still leave the queue, or the checker is left
  // staring at work they are not allowed to touch.
  it('treats a batch with nothing pending as finished even when scripts were flagged', () => {
    const batch = getBatch('mbatch_006')!;
    expect(batch.scripts.some((s) => s.status === 'flagged')).toBe(true);
    expect(batch.scripts.some((s) => s.status === 'pending')).toBe(false);
    expect(batchStatus(batch)).toBe('completed');

    expect(listCompletedBatches(DEMO_CHECKER_ID).map((b) => b.id)).toContain('mbatch_006');
    expect(listOpenBatches(DEMO_CHECKER_ID).map((b) => b.id)).not.toContain('mbatch_006');

    // Progress reflects marks only, so a flagged remainder shows as short of 100%.
    const row = listBatches(DEMO_CHECKER_ID).find((b) => b.id === 'mbatch_006')!;
    expect(row.progressPercent).toBeLessThan(100);
    expect(row.flaggedScripts).toBe(3);
  });

  it('reports progress that matches the underlying scripts', () => {
    for (const row of listBatches(DEMO_CHECKER_ID)) {
      const batch = getBatch(row.id)!;
      const marked = batch.scripts.filter((s) => s.status === 'marked').length;
      expect(row.markedScripts).toBe(marked);
      expect(row.totalScripts).toBe(batch.scripts.length);
      expect(row.progressPercent).toBe(Math.round((marked / batch.scripts.length) * 100));
      // Every script is accounted for in exactly one bucket.
      expect(row.markedScripts + row.flaggedScripts + row.pendingScripts).toBe(row.totalScripts);
    }
  });

  it('dates a batch as completed only once nothing is left pending', () => {
    for (const row of listBatches(DEMO_CHECKER_ID)) {
      if (row.status === 'completed') expect(row.completedAt).toBeDefined();
      else expect(row.completedAt).toBeUndefined();
    }
  });

  it('splits the queue from the history with no overlap and nothing lost', () => {
    const open = listOpenBatches(DEMO_CHECKER_ID);
    const done = listCompletedBatches(DEMO_CHECKER_ID);

    expect(open.every((b) => b.status !== 'completed')).toBe(true);
    expect(done.every((b) => b.status === 'completed')).toBe(true);
    expect(open.length + done.length).toBe(listBatches(DEMO_CHECKER_ID).length);
    expect(open.length).toBeGreaterThan(0);
    expect(done.length).toBeGreaterThan(0);
  });

  it('offers a part-done batch as "up next" ahead of an untouched one', () => {
    const next = nextBatch(DEMO_CHECKER_ID);
    expect(next?.status).toBe('in-progress');
  });

  it('totals the workload from the scripts, counting flagged work as out of the queue', () => {
    const scripts = ownScripts();
    const summary = getWorkloadSummary(DEMO_CHECKER_ID);

    expect(summary.assignedTotal).toBe(scripts.length);
    expect(summary.marked).toBe(scripts.filter((s) => s.status === 'marked').length);
    expect(summary.flagged).toBe(scripts.filter((s) => s.status === 'flagged').length);
    expect(summary.remaining).toBe(scripts.filter((s) => s.status === 'pending').length);
    expect(summary.marked + summary.remaining + summary.flagged).toBe(summary.assignedTotal);
    expect(summary.progressPercent).toBe(
      Math.round((summary.marked / summary.assignedTotal) * 100),
    );
  });

  it('returns a zeroed summary for a checker with no assigned work', () => {
    const summary = getWorkloadSummary('chk_does_not_exist');
    expect(summary).toEqual({
      assignedTotal: 0,
      marked: 0,
      remaining: 0,
      flagged: 0,
      markedToday: 0,
      progressPercent: 0,
    });
  });

  it('charts one entry per day, ending today, summing to the marks in that window', () => {
    const days = 7;
    const counts = getDailyMarkingCounts(DEMO_CHECKER_ID, days);
    expect(counts).toHaveLength(days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(counts.at(-1)?.date).toBe(today.toISOString().slice(0, 10));

    // Dates run oldest → newest with no gaps.
    const dates = counts.map((c) => c.date);
    expect([...dates].sort()).toEqual(dates);

    const windowStart = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();
    const inWindow = ownScripts().filter(
      (s) => s.status === 'marked' && (s.markedAt ?? '') >= windowStart,
    ).length;
    expect(counts.reduce((sum, c) => sum + c.count, 0)).toBe(inWindow);
    expect(inWindow).toBeGreaterThan(0);
  });

  it('counts today’s marking against local midnight', () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const expected = ownScripts().filter(
      (s) => s.status === 'marked' && (s.markedAt ?? '') >= startOfToday.toISOString(),
    ).length;
    expect(getWorkloadSummary(DEMO_CHECKER_ID).markedToday).toBe(expected);
  });

  it('takes the batch maximum from the "correct" band', () => {
    for (const batch of markingBatches) {
      const correct = batch.rubric.find((r) => r.band === 'correct');
      expect(maxMarksFor(batch)).toBe(correct?.marks);
      // Bands run best to worst, so nothing can out-score "correct".
      expect(batch.rubric.every((r) => r.marks <= (correct?.marks ?? 0))).toBe(true);
    }
  });

  it('awards each marked script exactly what its band is worth', () => {
    for (const batch of markingBatches) {
      for (const script of batch.scripts.filter((s) => s.status === 'marked')) {
        const option = batch.rubric.find((r) => r.band === script.band);
        expect(script.awardedMarks).toBe(option?.marks);
      }
    }
  });

  it('labels a batch by its question', () => {
    const batch = markingBatches[0]!;
    expect(batchScopeLabel(batch)).toBe(batch.questionLabel);
  });

  // The whole point of question-wise assignment: a checker holds many candidates' answers
  // to ONE question, never several questions belonging to one candidate.
  it('assigns one question per batch, so no checker can hold a whole paper', () => {
    for (const batch of markingBatches) {
      expect(batch.questionLabel).toMatch(/^Q\d+$/);
      // Within a batch every script is a different candidate.
      const refs = batch.scripts.map((s) => s.candidateRefId);
      expect(new Set(refs).size).toBe(refs.length);
    }

    // No two of the demo checker's batches are the same question of the same paper.
    const keys = ownBatches().map((b) => `${b.paperId}:${b.questionLabel}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lists a batch’s scripts in running order, and nothing for an unknown batch', () => {
    const scripts = listScripts('mbatch_002');
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.map((s) => s.sequence)).toEqual(scripts.map((_, i) => i + 1));
    expect(listScripts('mbatch_nope')).toEqual([]);
  });
});

describe('marking.service — My Work drill-down', () => {
  it('groups the checker’s work by exam, resolving each exam’s name', () => {
    const exams = listCheckerExams(DEMO_CHECKER_ID);
    expect(exams.length).toBeGreaterThan(1);

    const closed = exams.find((e) => e.examId === 'exam_closed');
    expect(closed?.examName).toBe('Class 12 Annual Examination');
    expect(closed?.session).toBe('Annual 2025');

    // Counts roll up from the batches, not from anything stored on the exam.
    const own = ownBatches().filter((b) => b.examId === 'exam_closed');
    expect(closed?.questionCount).toBe(own.length);
    expect(closed?.subjectCount).toBe(new Set(own.map((b) => b.subjectId)).size);
    expect(closed?.totalScripts).toBe(own.flatMap((b) => b.scripts).length);
  });

  it('never shows an exam belonging only to another checker', () => {
    const exams = listCheckerExams('chk_002').map((e) => e.examId);
    expect(exams).toEqual(['exam_closed']);
    // chk_002 has one batch, so its totals must not include the demo checker's work.
    const only = listCheckerExams('chk_002')[0];
    expect(only?.questionCount).toBe(1);
  });

  it('lists only the subjects the checker holds work in for an exam', () => {
    const subjects = listCheckerSubjects(DEMO_CHECKER_ID, 'exam_closed');
    expect(subjects.map((s) => s.subject).sort()).toEqual(['Biology', 'Chemistry', 'Physics']);

    const chem = subjects.find((s) => s.subjectId === 'sub_chem');
    expect(chem?.questionCount).toBe(2);
    expect(chem?.totalScripts).toBe(36 + 28);
  });

  it('returns nothing for an exam or subject the checker has no work in', () => {
    expect(listCheckerSubjects(DEMO_CHECKER_ID, 'exam_draft')).toEqual([]);
    expect(listCheckerAnswers(DEMO_CHECKER_ID, 'exam_closed', 'sub_math')).toEqual([]);
  });

  /**
   * Physics in this exam is held by BOTH checkers, so it is the only place a missing
   * `checkerId` filter would show. Without this the scoping here is untested — dropping
   * the filter passes every other assertion in this file.
   */
  it('never lists another checker’s answers for a subject they share', () => {
    const answers = listCheckerAnswers(DEMO_CHECKER_ID, 'exam_closed', 'sub_phy');
    const foreign = getBatch('mbatch_100')!;
    expect(foreign.subjectId).toBe('sub_phy');
    expect(foreign.examId).toBe('exam_closed');
    expect(foreign.checkerId).not.toBe(DEMO_CHECKER_ID);

    expect(answers.some((a) => a.batchId === 'mbatch_100')).toBe(false);
    expect(answers).toHaveLength(40 + 40);

    // And the other checker sees only their own.
    const theirs = listCheckerAnswers('chk_002', 'exam_closed', 'sub_phy');
    expect(theirs.every((a) => a.batchId === 'mbatch_100')).toBe(true);
  });

  it('lists every answer for a subject, tagged with its question', () => {
    const answers = listCheckerAnswers(DEMO_CHECKER_ID, 'exam_closed', 'sub_chem');
    expect(answers).toHaveLength(36 + 28);
    expect(new Set(answers.map((a) => a.questionLabel))).toEqual(new Set(['Q2', 'Q7']));
    // Each row carries what its answer can score, taken from its own batch rubric.
    expect(answers.find((a) => a.questionLabel === 'Q7')?.maxMarks).toBe(15);
  });

  /**
   * The list is a register the checker works down. If it re-sorted as they marked, the
   * position they are looking at ("7 of 24") would jump under them mid-task.
   */
  it('keeps a fixed order that marking does not disturb', () => {
    const before = listCheckerAnswers(DEMO_CHECKER_ID, 'exam_closed', 'sub_chem').map((a) => a.id);

    // Q2 sorts before Q7, and within a question the running order holds.
    const answers = listCheckerAnswers(DEMO_CHECKER_ID, 'exam_closed', 'sub_chem');
    expect(answers[0]?.questionLabel).toBe('Q2');
    expect(answers.at(-1)?.questionLabel).toBe('Q7');

    const target = answers.find((a) => a.status === 'pending')!;
    markScript(target.id, { band: 'correct' });

    const after = listCheckerAnswers(DEMO_CHECKER_ID, 'exam_closed', 'sub_chem').map((a) => a.id);
    expect(after).toEqual(before);
  });

  it('walks forward to the next answer needing a mark, skipping flagged ones', () => {
    const answers = listCheckerAnswers(DEMO_CHECKER_ID, 'exam_open', 'sub_bio');
    const first = answers[0]!;

    const next = nextAnswerInSubject(DEMO_CHECKER_ID, 'exam_open', 'sub_bio', first.id);
    expect(next?.id).not.toBe(first.id);
    expect(next?.status).toBe('pending');

    flagScript(next!.id, 'Unreadable');
    const afterFlag = nextAnswerInSubject(DEMO_CHECKER_ID, 'exam_open', 'sub_bio', first.id);
    expect(afterFlag?.id).not.toBe(next?.id);
    expect(afterFlag?.status).toBe('pending');
  });

  // Answers skipped earlier must not be stranded once the end of the list is reached.
  it('wraps back to the start when nothing is left further down', () => {
    const answers = listCheckerAnswers(DEMO_CHECKER_ID, 'exam_open', 'sub_bio');
    const last = answers.at(-1)!;
    const next = nextAnswerInSubject(DEMO_CHECKER_ID, 'exam_open', 'sub_bio', last.id);
    expect(next).toBeDefined();
    expect(answers.indexOf(answers.find((a) => a.id === next!.id)!)).toBeLessThan(
      answers.length - 1,
    );
  });
});

/**
 * These mutate the store, so they work on `mbatch_100` — the batch belonging to the OTHER
 * checker. Nothing above asserts against it, so recording marks here cannot make the
 * read-only expectations flicker depending on test order.
 */
describe('marking.service — recording a mark', () => {
  const BATCH = 'mbatch_100';
  const CHECKER = 'chk_002';

  it('takes the marks from the batch rubric, never from the caller', () => {
    const batch = getBatch(BATCH)!;
    const partial = batch.rubric.find((r) => r.band === 'partially-correct')!;

    const marked = markScript(`${BATCH}_scr_005`, { band: 'partially-correct' });
    expect(marked?.status).toBe('marked');
    expect(marked?.band).toBe('partially-correct');
    expect(marked?.awardedMarks).toBe(partial.marks);
    expect(marked?.markedAt).toBeDefined();

    // A different band awards that band's marks — the rubric is the only source.
    const correct = batch.rubric.find((r) => r.band === 'correct')!;
    const regraded = markScript(`${BATCH}_scr_005`, { band: 'correct' });
    expect(regraded?.awardedMarks).toBe(correct.marks);
  });

  it('stores a trimmed comment and drops an empty one', () => {
    const withComment = markScript(`${BATCH}_scr_006`, {
      band: 'correct',
      comment: '  Method correct, units missing.  ',
    });
    expect(withComment?.comment).toBe('Method correct, units missing.');

    const cleared = markScript(`${BATCH}_scr_006`, { band: 'correct', comment: '   ' });
    expect(cleared?.comment).toBeUndefined();
  });

  it('stores annotations as given and drops an empty set', () => {
    const annotations = [
      {
        id: 'ann_1',
        tool: 'tick' as const,
        points: [{ x: 0.5, y: 0.25 }],
        color: 'success' as const,
        createdAt: '2026-07-21T10:00:00.000Z',
      },
    ];

    const withAnnotations = markScript(`${BATCH}_scr_007`, { band: 'correct', annotations });
    expect(withAnnotations?.annotations).toHaveLength(1);
    expect(withAnnotations?.annotations?.[0]?.points[0]).toEqual({ x: 0.5, y: 0.25 });

    const cleared = markScript(`${BATCH}_scr_007`, { band: 'correct', annotations: [] });
    expect(cleared?.annotations).toBeUndefined();
  });

  it('returns undefined for a script that does not exist', () => {
    expect(markScript('nope', { band: 'correct' })).toBeUndefined();
    expect(flagScript('nope', 'reason')).toBeUndefined();
  });

  it('flags a script, clearing any mark it already carried', () => {
    markScript(`${BATCH}_scr_008`, { band: 'correct' });
    const flagged = flagScript(`${BATCH}_scr_008`, '  Scan unreadable.  ');

    expect(flagged?.status).toBe('flagged');
    expect(flagged?.flagReason).toBe('Scan unreadable.');
    // A flag is not a mark — nothing should still look awarded.
    expect(flagged?.band).toBeUndefined();
    expect(flagged?.awardedMarks).toBeUndefined();
    expect(flagged?.markedAt).toBeUndefined();
  });

  it('clears the flag when the script is later marked', () => {
    flagScript(`${BATCH}_scr_009`, 'Unreadable');
    const marked = markScript(`${BATCH}_scr_009`, { band: 'incorrect' });
    expect(marked?.status).toBe('marked');
    expect(marked?.flagReason).toBeUndefined();
  });

  it('walks to the next pending script and skips anything flagged', () => {
    flagScript(`${BATCH}_scr_010`, 'Blank page');
    const next = nextPendingScript(BATCH, 9);
    expect(next?.status).toBe('pending');
    expect(next?.id).not.toBe(`${BATCH}_scr_010`);
    expect(next!.sequence).toBeGreaterThan(9);
  });

  it('wraps back to the first pending script at the end of a batch', () => {
    const pending = listScripts(BATCH).filter((s) => s.status === 'pending');
    expect(pending.length).toBeGreaterThan(0);
    // Past the last sequence there is nothing "after", so it starts again from the top.
    const next = nextPendingScript(BATCH, 9999);
    expect(next?.id).toBe(pending[0]?.id);
  });

  it('moves the workload numbers when a script is marked', () => {
    const pending = listScripts(BATCH).find((s) => s.status === 'pending');
    expect(pending).toBeDefined();

    const before = getWorkloadSummary(CHECKER);
    markScript(pending!.id, { band: 'correct' });
    const after = getWorkloadSummary(CHECKER);

    expect(after.marked).toBe(before.marked + 1);
    expect(after.remaining).toBe(before.remaining - 1);
    expect(after.assignedTotal).toBe(before.assignedTotal);
    // It counts as marked today, so the dashboard's "today" figure moves too.
    expect(after.markedToday).toBe(before.markedToday + 1);
  });

  it('finds a script together with the batch that owns it', () => {
    const found = findScript(`${BATCH}_scr_001`);
    expect(found?.batch.id).toBe(BATCH);
    expect(found?.script.sequence).toBe(1);
    expect(findScript('nope')).toBeUndefined();
  });
});
