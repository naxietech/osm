/**
 * E-Sheet templates — the reusable paper structure an answer sheet is generated from.
 *
 * A template is STANDALONE: not tied to an exam or a subject. The examiner describes a
 * paper's shape once (its questions, their sub-parts, the marks and the writing space each
 * needs) and picks it later when generating e-sheets, so one structure serves many exams.
 *
 * THE UNIT IS THE SUB-PART. One `ESheetTemplateAnswer` is one answer, carrying its own marks.
 * A question is only a grouping — it holds the number and the type, and nothing that is marked.
 *
 * A WRITTEN answer is also the unit of segmentation: it gets its own crop rectangle and becomes
 * its own marking batch. MCQ answers are NOT segmented individually — they are machine-read
 * (OMR), so a whole question's bubble grid is one rectangle and no single bubble row is ever
 * cropped and handed to anyone. `lines` therefore does not apply to MCQ, and nothing is drawn
 * around a bubble row on the sheet.
 *
 * The correct answers are NOT here: a template is reused across exams whose keys differ, so the
 * answer key belongs to e-sheet generation.
 *
 * The examiner does NOT choose page numbers. Writing space is given in ruled lines and the
 * layout engine (`lib/e-sheet-layout`) computes every page and rectangle. PAGE 1 IS ALWAYS AN
 * INFORMATION COVER — QR, roll number, school, class, subject, candidate name, date and these
 * instructions — and questions begin on page 2, each on a page of its own. Page geometry is
 * therefore derived, never stored — see `e-sheet-layout.types`.
 */

/** The kinds of question a template can describe (fixed list). */
export type ESheetQuestionType = 'mcq' | 'short-answer' | 'long-answer';

/** How sub-parts are numbered on the printed sheet: (a)(b)(c) or (i)(ii)(iii). */
export type SubPartLabelStyle = 'alpha' | 'roman';

/**
 * How much of a page side a written answer gets.
 *
 * Expressed as a share of a side rather than a line count, because that is how an examiner
 * thinks about a paper ("this one needs half a page"). The layout engine turns it into ruled
 * lines, sized so the stated number of answers really does fit one side once each answer's
 * label and the gaps between them are paid for — four quarters fill a side exactly.
 */
export type ESheetAnswerSpace = 'quarter' | 'third' | 'half' | 'full' | 'two-sides';

/** Reading order, smallest first — drives the picker and any display list. */
export const ANSWER_SPACE_ORDER: readonly ESheetAnswerSpace[] = [
  'quarter',
  'third',
  'half',
  'full',
  'two-sides',
];

export const ANSWER_SPACE_LABELS: Record<ESheetAnswerSpace, string> = {
  quarter: '¼ side',
  third: '⅓ side',
  half: '½ side',
  full: 'Full side',
  'two-sides': 'Two sides',
};

/** Space a written answer gets when neither it nor its question says otherwise. */
export const DEFAULT_ANSWER_SPACE: ESheetAnswerSpace = 'quarter';

/**
 * One answer — a sub-part, and the unit of segmentation and marking.
 *
 * Its label is positional (first answer = "a"), so it is derived via `answerLabel()` rather
 * than stored; nothing can then drift when an answer is inserted or removed.
 */
export interface ESheetTemplateAnswer {
  id: string;
  /**
   * Overrides the question's `defaultSpace` for this one answer — for the part that needs more
   * room than its siblings. Absent means "use the question's default". Ignored for MCQ, which
   * prints a fixed-height bubble row.
   */
  space?: ESheetAnswerSpace;
  maxMarks: number;
}

export interface ESheetTemplateQuestion {
  id: string;
  /** The question's number on the paper, e.g. 4 for "Q4". Unique within a template. */
  questionNo: number;
  type: ESheetQuestionType;
  /** MCQ only — bubbles printed per answer. Defaults to 4. */
  optionCount?: number;
  /**
   * How THIS question's sub-parts are numbered. Per question, not per sheet: one paper often
   * mixes "1(a) 1(b)" with "2(i) 2(ii)". Defaults to `alpha`.
   */
  subPartLabelStyle?: SubPartLabelStyle;
  /**
   * Writing space every sub-part of this question gets, unless that sub-part overrides it.
   * Set once per question so a 12-part paper is not 12 identical choices. Written types only.
   */
  defaultSpace?: ESheetAnswerSpace;
  /** One entry per sub-part. A question with a single entry prints as "Q4", not "Q4(a)". */
  answers: ESheetTemplateAnswer[];
}

export interface ESheetTemplate {
  id: string;
  /** Unique (case-insensitive) — how the examiner picks it at generation time. */
  name: string;
  /** Optional cover-page block (e.g. "Write inside the corner marks"). Space is reserved. */
  instructions?: string;
  questions: ESheetTemplateQuestion[];
  /** Deactivated templates stay for reference but are not offered for new e-sheets. */
  isActive: boolean;
  createdAt: string;
}

/** List/table row — every total is derived from `questions`, never stored. */
export interface ESheetTemplateListItem {
  id: string;
  name: string;
  questionCount: number;
  /** Number of answers (sub-parts) across every question — what gets marked. */
  answerCount: number;
  totalMarks: number;
  /** Pages the layout engine produces for this template. */
  pageCount: number;
  isActive: boolean;
  createdAt: string;
}

/** Answer payload when creating/editing; the service assigns ids. */
export interface ESheetTemplateAnswerInput {
  space?: ESheetAnswerSpace;
  maxMarks: number;
}

export interface ESheetTemplateQuestionInput {
  questionNo: number;
  type: ESheetQuestionType;
  optionCount?: number;
  subPartLabelStyle?: SubPartLabelStyle;
  defaultSpace?: ESheetAnswerSpace;
  answers: ESheetTemplateAnswerInput[];
}

export interface CreateESheetTemplateDto {
  name: string;
  instructions?: string;
  questions: ESheetTemplateQuestionInput[];
}

export interface UpdateESheetTemplateDto {
  name?: string;
  instructions?: string;
  /** Full replacement list; the service re-assigns question and answer ids. */
  questions?: ESheetTemplateQuestionInput[];
  isActive?: boolean;
}

/** Bubbles printed per MCQ answer when a question does not say otherwise. */
export const DEFAULT_MCQ_OPTION_COUNT = 4;

/** MCQ answers are scored by the scanner, so they never enter a checker's queue. */
export function questionTypeIsMachineRead(type: ESheetQuestionType): boolean {
  return type === 'mcq';
}

/** Whether writing space applies — MCQ prints bubbles, so it has no line count. */
export function questionTypeUsesLines(type: ESheetQuestionType): boolean {
  return !questionTypeIsMachineRead(type);
}

/** Alphabetic positional label: 0 → "a", 25 → "z", 26 → "aa". */
function alphaLabel(index: number): string {
  let remaining = index;
  let label = '';
  do {
    label = String.fromCharCode(97 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return label;
}

const ROMAN_PARTS: ReadonlyArray<readonly [number, string]> = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

/** Lowercase roman positional label: 0 → "i", 3 → "iv", 9 → "x". */
function romanLabel(index: number): string {
  let remaining = index + 1;
  let label = '';
  for (const [value, numeral] of ROMAN_PARTS) {
    while (remaining >= value) {
      label += numeral;
      remaining -= value;
    }
  }
  return label;
}

/**
 * Positional sub-part label in the chosen style. Derived from the answer's index so
 * inserting or removing one relabels the rest automatically.
 */
export function answerPartLabel(index: number, style: SubPartLabelStyle = 'alpha'): string {
  return style === 'roman' ? romanLabel(index) : alphaLabel(index);
}

/**
 * How an MCQ bubble row is named: its positional label alone — "i." or "a." — never the question
 * number.
 *
 * A bubble row is not a crop region and never leaves its question: the heading printed above the
 * grid already says which question it belongs to, so repeating it on every row is noise. It also
 * costs the scanner — the number column has to be wide enough for the longest label, and a wide
 * column pushes the bubbles across the page, which is exactly what an OMR grid must not do.
 */
export function mcqAnswerLabel(index: number, style: SubPartLabelStyle = 'alpha'): string {
  return `${answerPartLabel(index, style)}.`;
}

/**
 * How one WRITTEN answer is named, on the sheet and in a checker's queue: "Q. No. 4" when the
 * question has a single answer, "Q. No. 4 Part (i)" — or "Part (a)" in alpha style — when it is
 * one of several. Spelled out rather than abbreviated because a written answer IS cropped out and
 * marked on its own, so its label is all a checker has to place it by. MCQ rows use
 * `mcqAnswerLabel` instead.
 */
export function answerLabel(
  questionNo: number,
  index: number,
  answerCount: number,
  style: SubPartLabelStyle = 'alpha',
): string {
  const question = `Q. No. ${questionNo}`;
  return answerCount <= 1 ? question : `${question} Part (${answerPartLabel(index, style)})`;
}
