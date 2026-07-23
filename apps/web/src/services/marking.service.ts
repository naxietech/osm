/**
 * Mock marking service (frontend only) — what a checker has been assigned and done.
 *
 * Work is assigned ONE QUESTION AT A TIME: a batch is every candidate's answer to a
 * single question, so a checker never holds a complete paper.
 *
 * Reads only. Assignment belongs to the examiner (Marking Assignment, not yet built) and
 * recording a mark belongs to the marking screen (also not yet built), so this module
 * seeds a plausible workload and derives every number the checker's dashboard shows
 * rather than hard-coding totals into the page.
 *
 * Everything here is anonymous by construction: scripts carry an opaque `candidateRefId`
 * and there is no path from this module to a student record.
 *
 * TODO: replace with a real markingApi (assigned batches, progress, submit a band).
 */
import {
  type CheckerExamListItem,
  type CheckerSubjectListItem,
  type DailyMarkingCount,
  type MarkingAnswerListItem,
  type MarkingBandOption,
  type MarkingBatch,
  type MarkingBatchListItem,
  type MarkingBatchStatus,
  type MarkingProgressCounts,
  type MarkingScript,
  type MarkingWorkloadSummary,
  type SubmitMarkDto,
} from '@oses/types';

import { findExam } from './mock-store';

// Labels and colours for bands and statuses live in the status-badge molecule, not here:
// the design system may not import services, so keeping a copy in this file would give
// the same status two sources of truth that could drift apart.

/**
 * Reference instant for the whole seed, captured once at module load. Every seeded
 * timestamp is derived from it, so "marked today" and the 7-day pace chart line up with
 * whenever the app is opened — and stay stable for the duration of a session.
 */
const NOW = new Date();

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO timestamp `days` before NOW, pinned to a fixed hour. Used for assigned/due dates. */
function daysAgo(days: number, hour = 11): string {
  const d = new Date(NOW.getTime() - days * DAY_MS);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * When a script was marked: `days` days back, offset an hour so day 0 is always slightly
 * in the past. Pinning it to a clock hour instead would put "today" in the future
 * whenever the app is opened before that hour.
 */
function markedDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS - 60 * 60 * 1000).toISOString();
}

/**
 * Deterministic pseudo-random generator (a small linear congruential generator).
 * Used instead of Math.random so the seeded workload — and therefore every test
 * assertion about it — is identical on every run.
 */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** A rubric scaled to a batch maximum: full / two-thirds / one-third / nothing. */
function rubricFor(maxMarks: number): MarkingBandOption[] {
  return [
    { band: 'correct', marks: maxMarks },
    { band: 'partially-correct', marks: Math.round(maxMarks * 0.66) },
    { band: 'partially-incorrect', marks: Math.round(maxMarks * 0.33) },
    { band: 'incorrect', marks: 0 },
  ];
}

interface BatchSeed {
  id: string;
  /** Defaults to the demo checker; set to seed another checker's work. */
  checkerId?: string;
  examId: string;
  paperId: string;
  subjectId: string;
  subject: string;
  questionLabel: string;
  /** The page the question sits on — traceability only, not the assignable unit. */
  pageNumber: number;
  maxMarks: number;
  totalScripts: number;
  /** How many of those scripts are already marked. */
  markedScripts: number;
  /** How many are flagged to the supervisor. */
  flaggedScripts: number;
  assignedDaysAgo: number;
  dueInDays: number;
}

/**
 * The demo checker's workload — six questions across three subjects of the Class 12
 * Annual 2025 paper (see mock-store `exam_closed`). Deliberately mixed: one question
 * finished, two part done, two untouched, so the queue, history and progress numbers all
 * have something to show.
 *
 * Note every batch is ONE question. The same checker holds several questions, but always
 * across many candidates — never several questions of the same candidate's paper.
 */
const BATCH_SEEDS: BatchSeed[] = [
  {
    id: 'mbatch_001',
    examId: 'exam_closed',
    paperId: 'pap_c1',
    subjectId: 'sub_phy',
    subject: 'Physics',
    questionLabel: 'Q1',
    pageNumber: 2,
    maxMarks: 8,
    totalScripts: 40,
    markedScripts: 40,
    flaggedScripts: 0,
    assignedDaysAgo: 6,
    dueInDays: 1,
  },
  {
    id: 'mbatch_002',
    examId: 'exam_closed',
    paperId: 'pap_c1',
    subjectId: 'sub_phy',
    subject: 'Physics',
    questionLabel: 'Q4',
    pageNumber: 3,
    maxMarks: 12,
    totalScripts: 40,
    markedScripts: 26,
    flaggedScripts: 2,
    assignedDaysAgo: 4,
    dueInDays: 2,
  },
  {
    id: 'mbatch_003',
    examId: 'exam_closed',
    paperId: 'pap_c2',
    subjectId: 'sub_chem',
    subject: 'Chemistry',
    questionLabel: 'Q2',
    pageNumber: 2,
    maxMarks: 10,
    totalScripts: 36,
    markedScripts: 15,
    flaggedScripts: 1,
    assignedDaysAgo: 2,
    dueInDays: 3,
  },
  {
    id: 'mbatch_004',
    examId: 'exam_closed',
    paperId: 'pap_c2',
    subjectId: 'sub_chem',
    subject: 'Chemistry',
    questionLabel: 'Q7',
    pageNumber: 4,
    maxMarks: 15,
    totalScripts: 28,
    markedScripts: 0,
    flaggedScripts: 0,
    assignedDaysAgo: 1,
    dueInDays: 5,
  },
  {
    id: 'mbatch_005',
    examId: 'exam_closed',
    paperId: 'pap_c3',
    subjectId: 'sub_bio',
    subject: 'Biology',
    questionLabel: 'Q5',
    pageNumber: 3,
    maxMarks: 10,
    totalScripts: 22,
    markedScripts: 0,
    flaggedScripts: 0,
    assignedDaysAgo: 1,
    dueInDays: 6,
  },
  {
    // Nothing pending, but three scripts went to the supervisor. The checker can do no
    // more here, so this must read as finished and leave their queue — the case that
    // separates "all scripts settled" from "all scripts marked".
    id: 'mbatch_006',
    examId: 'exam_closed',
    paperId: 'pap_c3',
    subjectId: 'sub_bio',
    subject: 'Biology',
    questionLabel: 'Q3',
    pageNumber: 2,
    maxMarks: 8,
    totalScripts: 20,
    markedScripts: 17,
    flaggedScripts: 3,
    assignedDaysAgo: 5,
    dueInDays: 1,
  },
  // A second exam, so My Work genuinely groups by exam rather than showing one row.
  {
    id: 'mbatch_007',
    examId: 'exam_open',
    paperId: 'pap_o1',
    subjectId: 'sub_phy',
    subject: 'Physics',
    questionLabel: 'Q2',
    pageNumber: 2,
    maxMarks: 6,
    totalScripts: 30,
    markedScripts: 9,
    flaggedScripts: 0,
    assignedDaysAgo: 3,
    dueInDays: 4,
  },
  {
    id: 'mbatch_008',
    examId: 'exam_open',
    paperId: 'pap_o3',
    subjectId: 'sub_bio',
    subject: 'Biology',
    questionLabel: 'Q6',
    pageNumber: 4,
    maxMarks: 12,
    totalScripts: 24,
    markedScripts: 0,
    flaggedScripts: 0,
    assignedDaysAgo: 2,
    dueInDays: 7,
  },
  {
    // Another checker's work. Present so scoping is exercised for real: every query must
    // filter by checker, and opening this batch as the demo checker must be refused.
    id: 'mbatch_100',
    checkerId: 'chk_002',
    examId: 'exam_closed',
    paperId: 'pap_c1',
    subjectId: 'sub_phy',
    subject: 'Physics',
    questionLabel: 'Q9',
    pageNumber: 5,
    maxMarks: 10,
    totalScripts: 12,
    markedScripts: 4,
    flaggedScripts: 0,
    assignedDaysAgo: 3,
    dueInDays: 4,
  },
];

/** The checker every seeded batch belongs to — the approved demo checker (chk_001). */
export const DEMO_CHECKER_ID = 'chk_001';

/**
 * Stand-in for the cropped answer image.
 *
 * Real crops come from e-sheet generation → scanning → splitting, none of which exist
 * yet, so every seeded script points at this instead. It is drawn rather than fetched so
 * the app has no external image dependency. Colours are literal because a data-URI SVG
 * cannot see the page's CSS variables.
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 460" width="800" height="460">
<rect width="800" height="460" fill="#fbfbf9"/>
<g stroke="#e4e4e0" stroke-width="1">
<line x1="40" y1="90" x2="760" y2="90"/><line x1="40" y1="150" x2="760" y2="150"/>
<line x1="40" y1="210" x2="760" y2="210"/><line x1="40" y1="270" x2="760" y2="270"/>
<line x1="40" y1="330" x2="760" y2="330"/><line x1="40" y1="390" x2="760" y2="390"/>
</g>
<g stroke="#9aa0a6" stroke-width="2.5" fill="none" stroke-linecap="round">
<path d="M60 80 q40 -18 70 2 t65 -4 t80 6 t60 -8 t90 4"/>
<path d="M60 140 q55 -16 95 4 t70 -6 t110 8 t85 -6"/>
<path d="M60 200 q45 -14 80 2 t60 -4 t70 6"/>
<path d="M60 260 q60 -18 100 2 t80 -6 t120 8 t70 -4"/>
<path d="M60 320 q50 -12 85 4 t75 -8 t95 6"/>
</g>
<text x="400" y="436" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="#9aa0a6">Placeholder — the scanned answer crop will appear here</text>
</svg>`;

/** Data URI for the placeholder answer image. */
export const PLACEHOLDER_ANSWER_IMAGE = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;

const FLAG_REASONS = [
  'Scan unreadable in the answer area.',
  'Page appears blank — possible scanning fault.',
  'Answer continues onto an unassigned page.',
];

function buildBatch(seed: BatchSeed, seedIndex: number): MarkingBatch {
  const rubric = rubricFor(seed.maxMarks);
  const random = makeRandom(seed.pageNumber * 7919 + seedIndex * 104729 + 1);
  const scripts: MarkingScript[] = [];

  for (let i = 0; i < seed.totalScripts; i += 1) {
    const sequence = i + 1;
    const id = `${seed.id}_scr_${String(sequence).padStart(3, '0')}`;
    // Opaque, stable, and carries nothing about the candidate.
    const candidateRefId = `anon-${(seed.pageNumber * 100003 + sequence * 7919).toString(16)}`;
    const base = {
      id,
      batchId: seed.id,
      candidateRefId,
      sequence,
      imageUrl: PLACEHOLDER_ANSWER_IMAGE,
    };

    if (i < seed.markedScripts) {
      // Spread marked work across the full 7-day window so the pace chart has a shape
      // and no day is empty by construction.
      const bandOption = rubric[Math.floor(random() * rubric.length)] ?? rubric[0];
      const ageInDays = Math.floor(random() * 7);
      scripts.push({
        ...base,
        status: 'marked',
        band: bandOption!.band,
        awardedMarks: bandOption!.marks,
        markedAt: markedDaysAgo(ageInDays),
      });
    } else if (i < seed.markedScripts + seed.flaggedScripts) {
      scripts.push({
        ...base,
        status: 'flagged',
        flagReason: FLAG_REASONS[i % FLAG_REASONS.length]!,
      });
    } else {
      scripts.push({ ...base, status: 'pending' });
    }
  }

  return {
    id: seed.id,
    checkerId: seed.checkerId ?? DEMO_CHECKER_ID,
    examId: seed.examId,
    paperId: seed.paperId,
    subjectId: seed.subjectId,
    subject: seed.subject,
    questionLabel: seed.questionLabel,
    pageNumber: seed.pageNumber,
    rubric,
    assignedAt: daysAgo(seed.assignedDaysAgo, 9),
    dueAt: daysAgo(-seed.dueInDays, 17),
    scripts,
  };
}

/** Mutable batch store — mirrors the `checkers` array in checker.service. */
export const markingBatches: MarkingBatch[] = BATCH_SEEDS.map(buildBatch);

// ---- derivations ----------------------------------------------------------------

/** Highest marks obtainable on a batch — the `correct` band, by definition. */
export function maxMarksFor(batch: MarkingBatch): number {
  return batch.rubric.reduce((max, option) => Math.max(max, option.marks), 0);
}

/** What the batch covers, in words — e.g. "Q4". */
export function batchScopeLabel(batch: MarkingBatch): string {
  return batch.questionLabel;
}

/** Status is always derived from the scripts, so it cannot drift from reality. */
export function batchStatus(batch: MarkingBatch): MarkingBatchStatus {
  const settled = batch.scripts.filter((s) => s.status !== 'pending').length;
  if (settled === 0) return 'queued';
  if (settled === batch.scripts.length) return 'completed';
  return 'in-progress';
}

function toListItem(batch: MarkingBatch): MarkingBatchListItem {
  const total = batch.scripts.length;
  const marked = batch.scripts.filter((s) => s.status === 'marked').length;
  const flagged = batch.scripts.filter((s) => s.status === 'flagged').length;
  const status = batchStatus(batch);

  // The newest mark in a finished batch is when the checker actually finished it.
  const lastMarkedAt = batch.scripts
    .map((s) => s.markedAt)
    .filter((at): at is string => Boolean(at))
    .sort()
    .at(-1);

  return {
    id: batch.id,
    examId: batch.examId,
    subjectId: batch.subjectId,
    subject: batch.subject,
    scopeLabel: batchScopeLabel(batch),
    totalScripts: total,
    markedScripts: marked,
    flaggedScripts: flagged,
    pendingScripts: total - marked - flagged,
    progressPercent: total === 0 ? 0 : Math.round((marked / total) * 100),
    status,
    maxMarks: maxMarksFor(batch),
    assignedAt: batch.assignedAt,
    ...(batch.dueAt ? { dueAt: batch.dueAt } : {}),
    ...(status === 'completed' && lastMarkedAt ? { completedAt: lastMarkedAt } : {}),
  };
}

// ---- queries --------------------------------------------------------------------

export function getBatch(batchId: string): MarkingBatch | undefined {
  return markingBatches.find((b) => b.id === batchId);
}

function batchesOf(checkerId: string): MarkingBatch[] {
  return markingBatches.filter((b) => b.checkerId === checkerId);
}

/** Everything assigned to a checker, newest assignment first. */
export function listBatches(checkerId: string): MarkingBatchListItem[] {
  return batchesOf(checkerId)
    .map(toListItem)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}

/** The work queue — still has scripts to mark. Most-progressed first, so work finishes. */
export function listOpenBatches(checkerId: string): MarkingBatchListItem[] {
  return listBatches(checkerId)
    .filter((b) => b.status !== 'completed')
    .sort((a, b) => b.progressPercent - a.progressPercent);
}

/** History — batches the checker has finished, most recently completed first. */
export function listCompletedBatches(checkerId: string): MarkingBatchListItem[] {
  return listBatches(checkerId)
    .filter((b) => b.status === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
}

/** The batch to offer as "up next" — the one closest to done, else the first queued. */
export function nextBatch(checkerId: string): MarkingBatchListItem | undefined {
  const open = listOpenBatches(checkerId);
  return open.find((b) => b.status === 'in-progress') ?? open[0];
}

/** Scripts in a batch, in running order. Anonymous — safe to render to the checker. */
export function listScripts(batchId: string): MarkingScript[] {
  const batch = getBatch(batchId);
  if (!batch) return [];
  return [...batch.scripts].sort((a, b) => a.sequence - b.sequence);
}

// ---- My Work: exam → subject → answer -------------------------------------------

/** Roll a set of batches up into the counts every level of My Work displays. */
function countsFor(batches: MarkingBatch[]): MarkingProgressCounts {
  const scripts = batches.flatMap((b) => b.scripts);
  const marked = scripts.filter((s) => s.status === 'marked').length;
  const flagged = scripts.filter((s) => s.status === 'flagged').length;
  return {
    questionCount: batches.length,
    totalScripts: scripts.length,
    markedScripts: marked,
    pendingScripts: scripts.length - marked - flagged,
    flaggedScripts: flagged,
    progressPercent: scripts.length === 0 ? 0 : Math.round((marked / scripts.length) * 100),
  };
}

/**
 * Top of My Work — the exams this checker has work in.
 *
 * Exams with work still to do come first, so the checker lands on what needs doing rather
 * than on something they have already finished.
 */
export function listCheckerExams(checkerId: string): CheckerExamListItem[] {
  const byExam = new Map<string, MarkingBatch[]>();
  for (const batch of batchesOf(checkerId)) {
    const group = byExam.get(batch.examId);
    if (group) group.push(batch);
    else byExam.set(batch.examId, [batch]);
  }

  return [...byExam.entries()]
    .map(([examId, batches]) => {
      const exam = findExam(examId);
      return {
        examId,
        examName: exam?.name ?? examId,
        session: exam?.session ?? '—',
        subjectCount: new Set(batches.map((b) => b.subjectId)).size,
        ...countsFor(batches),
      };
    })
    .sort((a, b) => b.pendingScripts - a.pendingScripts || a.examName.localeCompare(b.examName));
}

/** Second level — the subjects of one exam this checker has work in. */
export function listCheckerSubjects(checkerId: string, examId: string): CheckerSubjectListItem[] {
  const bySubject = new Map<string, MarkingBatch[]>();
  for (const batch of batchesOf(checkerId).filter((b) => b.examId === examId)) {
    const group = bySubject.get(batch.subjectId);
    if (group) group.push(batch);
    else bySubject.set(batch.subjectId, [batch]);
  }

  return [...bySubject.entries()]
    .map(([subjectId, batches]) => ({
      subjectId,
      subject: batches[0]?.subject ?? subjectId,
      ...countsFor(batches),
    }))
    .sort((a, b) => b.pendingScripts - a.pendingScripts || a.subject.localeCompare(b.subject));
}

/**
 * Third level — every answer this checker holds for one subject of one exam.
 *
 * A subject can span several questions, so each row says which question it belongs to.
 *
 * The order is FIXED — question by question, then running order within each question. It
 * deliberately does not float unmarked answers to the top: the list is a register the
 * checker works down, and re-sorting as they mark would make "answer 7 of 24" jump around
 * under them while they are using it.
 */
export function listCheckerAnswers(
  checkerId: string,
  examId: string,
  subjectId: string,
): MarkingAnswerListItem[] {
  const batches = batchesOf(checkerId).filter(
    (b) => b.examId === examId && b.subjectId === subjectId,
  );

  const rows = batches.flatMap((batch) => {
    const maxMarks = maxMarksFor(batch);
    return batch.scripts.map((script) => ({
      id: script.id,
      batchId: batch.id,
      candidateRefId: script.candidateRefId,
      questionLabel: batch.questionLabel,
      sequence: script.sequence,
      status: script.status,
      maxMarks,
      ...(script.band ? { band: script.band } : {}),
      ...(script.awardedMarks !== undefined ? { awardedMarks: script.awardedMarks } : {}),
    }));
  });

  return rows.sort(
    (a, b) =>
      a.questionLabel.localeCompare(b.questionLabel, undefined, { numeric: true }) ||
      a.sequence - b.sequence,
  );
}

/**
 * The next answer still to mark in the same subject.
 *
 * Walks forward from `afterScriptId` in the list's fixed order, then wraps to the start
 * so answers skipped earlier are not stranded. Flagged answers are passed over — they are
 * the supervisor's now.
 */
export function nextAnswerInSubject(
  checkerId: string,
  examId: string,
  subjectId: string,
  afterScriptId?: string,
): MarkingAnswerListItem | undefined {
  const answers = listCheckerAnswers(checkerId, examId, subjectId);
  const from = afterScriptId ? answers.findIndex((a) => a.id === afterScriptId) : -1;

  const isNext = (a: MarkingAnswerListItem): boolean =>
    a.status === 'pending' && a.id !== afterScriptId;

  return answers.slice(from + 1).find(isNext) ?? answers.find(isNext);
}

// ---- actions --------------------------------------------------------------------

/** Find one script wherever it lives, plus the batch that owns it. */
export function findScript(
  scriptId: string,
): { script: MarkingScript; batch: MarkingBatch } | undefined {
  for (const batch of markingBatches) {
    const script = batch.scripts.find((s) => s.id === scriptId);
    if (script) return { script, batch };
  }
  return undefined;
}

/**
 * The next script still waiting to be marked, in running order. Flagged scripts are
 * skipped — they are the supervisor's now — so "next ungraded" never loops back onto
 * something the checker has already dealt with.
 */
export function nextPendingScript(batchId: string, afterSequence = 0): MarkingScript | undefined {
  const scripts = listScripts(batchId).filter((s) => s.status === 'pending');
  return scripts.find((s) => s.sequence > afterSequence) ?? scripts[0];
}

/**
 * Record a mark.
 *
 * The marks come from the batch rubric, never from the caller: the four-band scale exists
 * so the same band is worth the same everywhere, and letting a screen pass its own number
 * would quietly undo that.
 *
 * Note for the real backend: marking is append-only there — this would insert a new row
 * superseding any previous one, rather than mutating in place as the mock does.
 */
export function markScript(scriptId: string, input: SubmitMarkDto): MarkingScript | undefined {
  const found = findScript(scriptId);
  if (!found) return undefined;
  const { script, batch } = found;

  const option = batch.rubric.find((r) => r.band === input.band);
  if (!option) return undefined;

  script.status = 'marked';
  script.band = input.band;
  script.awardedMarks = option.marks;
  script.markedAt = new Date().toISOString();

  const comment = input.comment?.trim();
  if (comment) script.comment = comment;
  else delete script.comment;

  if (input.annotations && input.annotations.length > 0) script.annotations = input.annotations;
  else delete script.annotations;

  // Marking resolves a flag: the script is no longer waiting on anyone else.
  delete script.flagReason;
  return script;
}

/** Send a script to a supervisor. It leaves the checker's queue either way. */
export function flagScript(scriptId: string, reason: string): MarkingScript | undefined {
  const found = findScript(scriptId);
  if (!found) return undefined;
  const { script } = found;

  script.status = 'flagged';
  script.flagReason = reason.trim();
  // A flag is not a mark — clear anything a previous pass awarded.
  delete script.band;
  delete script.awardedMarks;
  delete script.markedAt;
  return script;
}

export function getWorkloadSummary(checkerId: string): MarkingWorkloadSummary {
  const scripts = batchesOf(checkerId).flatMap((b) => b.scripts);
  const marked = scripts.filter((s) => s.status === 'marked');
  const flagged = scripts.filter((s) => s.status === 'flagged').length;

  const midnight = new Date(NOW);
  midnight.setHours(0, 0, 0, 0);
  const startOfToday = midnight.toISOString();

  return {
    assignedTotal: scripts.length,
    marked: marked.length,
    // Flagged scripts have left the checker's hands, so they are not "still to do".
    remaining: scripts.length - marked.length - flagged,
    flagged,
    markedToday: marked.filter((s) => (s.markedAt ?? '') >= startOfToday).length,
    progressPercent: scripts.length === 0 ? 0 : Math.round((marked.length / scripts.length) * 100),
  };
}

const WEEKDAY: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Scripts marked per day over the last `days` days, oldest first and ending today.
 * Days with no marking are returned as zero, so the chart keeps an even axis.
 */
export function getDailyMarkingCounts(checkerId: string, days = 7): DailyMarkingCount[] {
  const marked = batchesOf(checkerId)
    .flatMap((b) => b.scripts)
    .filter((s) => s.status === 'marked' && s.markedAt);

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(NOW.getTime() - (days - 1 - index) * DAY_MS);
    day.setHours(0, 0, 0, 0);
    const start = day.toISOString();
    const end = new Date(day.getTime() + DAY_MS).toISOString();
    const date = start.slice(0, 10);

    return {
      date,
      label: WEEKDAY[day.getDay()] ?? date,
      count: marked.filter((s) => (s.markedAt ?? '') >= start && (s.markedAt ?? '') < end).length,
    };
  });
}
