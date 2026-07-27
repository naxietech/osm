/**
 * E-Sheet layout — what the layout engine produces from a template.
 *
 * These shapes are the contract between the engine (`apps/web/src/lib/e-sheet-layout`), the
 * on-screen preview, and eventually the Python worker that crops scanned pages. Nothing here
 * is stored on a template: the layout is recomputed from the template every time, so a
 * rectangle can never go stale against the questions it describes. The e-sheet generation
 * step snapshots it when it produces real per-candidate sheets.
 *
 * EVERY RECTANGLE IS IN PAGE FRACTIONS (0–1) of the full page including its margins. Storing
 * millimetres or pixels would break the moment a sheet is printed at a different scale or
 * scanned at a different resolution; fractions survive both.
 */
import type { ESheetQuestionType } from './e-sheet-template.types';

/** A rectangle on one page, as fractions of the page's width and height (0–1). */
export interface ESheetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where one answer's writing space continues across sides, when it needs more than one. */
export interface ESheetContinuation {
  /** 1-based slice of this answer. */
  index: number;
  total: number;
}

/** A detail the cover page asks for. Filled per candidate, blank on a template. */
export type ESheetCoverField =
  | 'roll-number'
  | 'school'
  | 'class'
  | 'subject'
  | 'student-name'
  | 'date';

/**
 * The information cover — page 1, and page 1 carries nothing else. Every candidate and exam
 * detail lives here so no answer page has to, which is what keeps a cropped answer anonymous:
 * the identity never appears on a page an evaluator can be shown.
 */
export interface ESheetCoverBlock {
  kind: 'cover';
  rect: ESheetRect;
  /** Details printed for the invigilator or candidate to complete, in printed order. */
  fields: ESheetCoverField[];
  /** Whether a per-candidate QR is printed here (generation fills it in). */
  hasQr: boolean;
  /**
   * Digit columns in the roll-number block. Each column is a write-in box above a 0–9 bubble
   * column, so the roll number is both readable and machine-scorable — the standard OMR grid.
   */
  rollNumberDigits: number;
  /**
   * Whether to print the "how to fill a bubble" legend. Only when the paper has machine-read
   * questions — an OMR reader is unforgiving about a half-filled or ticked bubble, so the
   * candidate is shown exactly what counts.
   */
  showsMarkingLegend: boolean;
}

/** The examiner's instructions. On the cover page, and only when the template has any. */
export interface ESheetInstructionsBlock {
  kind: 'instructions';
  rect: ESheetRect;
  text: string;
}

/** "Q4 · Long answer" — printed once per question, above its first answer on that side. */
export interface ESheetQuestionHeadingBlock {
  kind: 'question-heading';
  rect: ESheetRect;
  questionNo: number;
  type: ESheetQuestionType;
}

/** What gets drawn inside an answer's box. */
export type ESheetAnswerContent =
  | { kind: 'bubbles'; optionCount: number }
  | { kind: 'writing'; lineCount: number };

/**
 * One answer's box — and one crop region. This is what the scanner cuts out and what a
 * checker (or the OMR reader) is given.
 */
export interface ESheetAnswerBlock {
  kind: 'answer';
  rect: ESheetRect;
  answerId: string;
  questionNo: number;
  /** "Q4(a)" — the label a checker sees. */
  label: string;
  maxMarks: number;
  content: ESheetAnswerContent;
  /** Set only when this answer spans more than one side. */
  continuation?: ESheetContinuation;
}

export type ESheetBlock =
  | ESheetCoverBlock
  | ESheetInstructionsBlock
  | ESheetQuestionHeadingBlock
  | ESheetAnswerBlock;

export interface ESheetPage {
  /** 1-based. Each page is one printed side. Page 1 is always the information cover. */
  pageNumber: number;
  blocks: ESheetBlock[];
}

export interface ESheetLayout {
  pages: ESheetPage[];
  /** Answers across the whole template — what gets marked or machine-read. */
  answerCount: number;
  totalMarks: number;
}

/**
 * A crop rectangle for the scanner, flattened out of the pages.
 *
 * Written answers are segmented one-for-one: one region per answer slice, so an answer
 * spanning two sides appears twice with its continuation set.
 *
 * MCQ sub-parts are NOT segmented individually. A whole question's bubble grid is one
 * region — the OMR reader needs to know where the grid sits, but no single bubble row is
 * ever cropped and handed to anyone. That is why `answerIds` is a list: one entry for a
 * written answer, one per bubble row for an MCQ grid.
 */
export interface ESheetRegion {
  pageNumber: number;
  /** The answers this rectangle covers, in printed order. */
  answerIds: string[];
  questionNo: number;
  label: string;
  /** Total marks inside the rectangle — one answer's, or the grid's combined. */
  maxMarks: number;
  /** `bubbles` is read by OMR; `writing` goes to a checker. */
  contentKind: ESheetAnswerContent['kind'];
  rect: ESheetRect;
  continuation?: ESheetContinuation;
}
