/**
 * Marking — the work a checker is given, and what they have done with it.
 *
 * The unit of assignment is a BATCH: all the answers to ONE QUESTION of one paper, handed
 * to one checker. A checker therefore sees the same question from many candidates and
 * never a whole paper, so they cannot reconstruct one candidate's performance or be
 * swayed by it.
 *
 * Marks are recorded as one of FOUR BANDS — correct, partially correct, partially
 * incorrect, incorrect — and each batch carries its own rubric saying what each band is
 * worth. A checker picks a band; the marks follow from it. That is why there is no
 * free-form marks field a checker can type into.
 *
 * Every script here is ANONYMOUS. A script carries `candidateRefId` — an opaque handle —
 * and never a name, roll number, CNIC or date of birth. Nothing in this file should ever
 * grow a field that could identify a candidate to the person marking their paper.
 */

/** The four-band marking scale, ordered best → worst. */
export type MarkingBand = 'correct' | 'partially-correct' | 'partially-incorrect' | 'incorrect';

/** What one band is worth on one batch. The rubric is per-batch and configurable. */
export interface MarkingBandOption {
  band: MarkingBand;
  /** Marks this band awards. `correct` carries the batch's maximum. */
  marks: number;
}

/** What the checker drew on the answer. */
export type AnnotationTool =
  | 'pen'
  | 'highlighter'
  | 'rectangle'
  | 'ellipse'
  | 'arrow'
  | 'tick'
  | 'cross'
  | 'note';

/**
 * Annotation colours, named by meaning rather than by hue so they resolve to the theme's
 * tokens and follow the project's reserved meanings: success green, danger red,
 * warning amber.
 */
export type AnnotationColor = 'success' | 'danger' | 'warning' | 'brand';

/**
 * A point on the answer image, expressed as a FRACTION of the image's width and height
 * (0–1). Storing pixels would break the moment the image is zoomed, resized or shown on
 * another screen; fractions survive all three.
 */
export interface AnnotationPoint {
  x: number;
  y: number;
}

/**
 * One mark drawn on the answer.
 *
 * `points` carries the geometry and its length depends on the tool: `pen` and
 * `highlighter` hold the whole freehand stroke; `rectangle`, `ellipse` and `arrow` hold
 * two corners/ends; `tick`, `cross` and `note` hold a single position.
 *
 * Annotations are kept as data, never burned into the image, so a supervisor can review
 * them and a re-check can see exactly what the checker marked.
 */
export interface Annotation {
  id: string;
  tool: AnnotationTool;
  points: AnnotationPoint[];
  color: AnnotationColor;
  /** `note` only — the text of the pinned comment. */
  text?: string;
  createdAt: string;
}

/** Where one script stands. */
export type MarkingScriptStatus = 'pending' | 'marked' | 'flagged';

/** Where a whole batch stands. Derived from its scripts — never set by hand. */
export type MarkingBatchStatus = 'queued' | 'in-progress' | 'completed';

/** One candidate's page, awaiting or carrying a mark. */
export interface MarkingScript {
  id: string;
  batchId: string;
  /** Opaque candidate reference — the checker's only handle on whose paper this is. */
  candidateRefId: string;
  /** Running order within the batch, so the queue is stable across reloads. */
  sequence: number;
  status: MarkingScriptStatus;
  /** The band chosen; absent until marked. */
  band?: MarkingBand;
  /** Marks that band awarded, copied from the rubric at the time of marking. */
  awardedMarks?: number;
  markedAt?: string;
  /** Why it could not be marked — unreadable scan, blank page, suspected malpractice. */
  flagReason?: string;
  /** The checker's note explaining the band. Seen by supervisors, not by the candidate. */
  comment?: string;
  /** What the checker drew on the answer. */
  annotations?: Annotation[];
  /**
   * The cropped image of this answer. One question's region of the scan and nothing
   * else — no identity strip, no other answers.
   */
  imageUrl?: string;
}

/** What the checker submits when marking one script. */
export interface SubmitMarkDto {
  band: MarkingBand;
  comment?: string;
  annotations?: Annotation[];
}

/**
 * A bundle of scripts assigned to one checker.
 *
 * Note for the real backend: marking is append-only there — a correction is a new
 * superseding row, never an overwrite. This shape holds the CURRENT state, which is what
 * a dashboard reads; it is the projection of that history, not a replacement for it.
 */
export interface MarkingBatch {
  id: string;
  /** The checker this belongs to — `Checker.id`, not the user id. */
  checkerId: string;
  examId: string;
  paperId: string;
  subjectId: string;
  /** Denormalised for display; the checker never loads the whole exam. */
  subject: string;
  /** The question this batch covers — the assignable unit. e.g. "Q4". */
  questionLabel: string;
  /**
   * Which page of the booklet the question sits on. Informational — it traces a batch
   * back to the scanned page it was cropped from; it is not what gets assigned.
   */
  pageNumber: number;
  /** What each band is worth here. The highest is the batch maximum. */
  rubric: MarkingBandOption[];
  assignedAt: string;
  dueAt?: string;
  scripts: MarkingScript[];
}

/** Row shape for the checker's history table and the dashboard queue. */
export interface MarkingBatchListItem {
  id: string;
  /** Carried so a row can link back into the exam → subject → answer drill-down. */
  examId: string;
  subjectId: string;
  subject: string;
  /**
   * Human label for what the batch covers, e.g. "Q4". Kept separate from `questionLabel`
   * so it can widen later (a sub-part would read "Q4(a)") without touching every caller.
   */
  scopeLabel: string;
  totalScripts: number;
  markedScripts: number;
  flaggedScripts: number;
  pendingScripts: number;
  /** 0–100, rounded. */
  progressPercent: number;
  status: MarkingBatchStatus;
  /** Highest marks obtainable per script in this batch. */
  maxMarks: number;
  assignedAt: string;
  dueAt?: string;
  /** When the last script was marked; only set once the batch is complete. */
  completedAt?: string;
}

/**
 * Counts shared by every level of the checker's work list. The same totals are shown for
 * an exam, for a subject within it, and for anything else that groups scripts.
 */
export interface MarkingProgressCounts {
  questionCount: number;
  totalScripts: number;
  markedScripts: number;
  pendingScripts: number;
  flaggedScripts: number;
  /** 0–100, rounded. */
  progressPercent: number;
}

/** Top level of My Work: an exam the checker has been given work in. */
export interface CheckerExamListItem extends MarkingProgressCounts {
  examId: string;
  examName: string;
  session: string;
  subjectCount: number;
}

/** Second level: a subject within one exam. */
export interface CheckerSubjectListItem extends MarkingProgressCounts {
  subjectId: string;
  subject: string;
}

/**
 * Third level: one answer waiting to be marked. This is what the checker clicks to open
 * the marking screen. Anonymous — a reference and a question, nothing about the person.
 */
export interface MarkingAnswerListItem {
  id: string;
  batchId: string;
  candidateRefId: string;
  questionLabel: string;
  sequence: number;
  status: MarkingScriptStatus;
  band?: MarkingBand;
  awardedMarks?: number;
  /** The most this answer can score, from its batch rubric. */
  maxMarks: number;
}

/** The headline numbers on the checker's dashboard. */
export interface MarkingWorkloadSummary {
  /** Every script across every batch assigned to this checker. */
  assignedTotal: number;
  marked: number;
  /** Still to do — excludes flagged scripts, which are out of the checker's hands. */
  remaining: number;
  flagged: number;
  /** Marked since midnight, local time. */
  markedToday: number;
  /** 0–100, rounded. */
  progressPercent: number;
}

/** One bar in the "marking pace" chart. */
export interface DailyMarkingCount {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Short weekday label for the axis, e.g. "Mon". */
  label: string;
  count: number;
}
