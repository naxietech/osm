/**
 * E-Sheet layout engine — turns a template into printed pages and crop rectangles.
 *
 * The examiner never picks a page number. They say how many ruled lines each answer needs
 * and this flows the answers onto page sides, in the order the questions are listed.
 *
 * The flow rule: AN ANSWER NEVER STRADDLES A PAGE BREAK. If it does not fit in the space
 * left on the current side, the whole answer moves to the next side and the gap is left
 * blank — so almost every answer is a single clean crop. Only an answer asking for more
 * lines than a whole side can hold is split, and then it starts on a fresh side and takes
 * whole sides, so its slices are predictable full-side rectangles.
 *
 * A question heading is never orphaned: it is placed together with its first answer or not
 * at all, which is why capacity is computed per answer depending on whether it carries one.
 *
 * Everything is measured in millimetres internally and emitted as FRACTIONS of the page
 * (0–1). Fractions survive a different print scale or scan resolution; millimetres and
 * pixels do not. Nothing here is persisted — the layout is recomputed from the template, so
 * a rectangle cannot go stale against the questions it describes.
 *
 * All geometry lives in `GEOMETRY` below. Tune the sheet there and nowhere else.
 */
import {
  DEFAULT_ANSWER_SPACE,
  DEFAULT_MCQ_OPTION_COUNT,
  type ESheetAnswerBlock,
  type ESheetAnswerSpace,
  type ESheetBlock,
  type ESheetCoverField,
  type ESheetLayout,
  type ESheetPage,
  type ESheetRect,
  type ESheetRegion,
  type ESheetTemplate,
  type ESheetTemplateAnswer,
  type ESheetTemplateQuestion,
  answerLabel,
  mcqAnswerLabel,
  questionTypeUsesLines,
} from '@oses/types';

/**
 * How the cover's detail rows are arranged — one array per printed row. Short details share a
 * row; long ones get their own. The engine sizes the cover from this and the preview draws from
 * it, so the reserved height and the rendered layout cannot drift apart.
 *
 * `roll-number` is not here: it sits in the QR band above these rows.
 */
export const COVER_FIELD_ROWS: readonly (readonly ESheetCoverField[])[] = [
  ['school'],
  ['class', 'subject'],
  ['student-name'],
  ['date'],
];

/**
 * What the cover page asks for, in printed order. Fixed rather than configurable: every sheet
 * in the system must be identifiable the same way, and the scan pipeline reads this cover.
 */
export const COVER_FIELDS: readonly ESheetCoverField[] = [
  'roll-number',
  ...COVER_FIELD_ROWS.flat(),
];

/** A4 portrait, in millimetres, plus every block size the sheet is built from. */
export const GEOMETRY = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginMm: 15,
  /** Corner registration marks, page barcode and page number. Drawn as chrome on every
   *  side; reserved here so no block can overlap it. */
  headerMm: 12,
  /** The cover's title band ("ANSWER SHEET"). */
  coverTitleMm: 10,
  /** "ROLL NUMBER" caption above the digit boxes. */
  coverRollLabelMm: 5,
  /** The write-in digit box a candidate pens their roll number into. */
  coverRollBoxMm: 10,
  /** One 0–9 bubble row of the roll-number grid. Ten of these sit under the boxes. */
  coverRollBubbleRowMm: 7.5,
  /** The QR panel beside the roll-number grid. */
  coverQrMm: 26,
  /** One labelled detail row on the cover page (school, class, subject, name, date). */
  coverFieldRowMm: 12,
  /** The "how to fill the bubbles" legend, printed only when the paper has MCQs. */
  coverLegendMm: 16,
  /** Padding inside the cover block, top and bottom combined. */
  coverPaddingMm: 8,
  instructionsPaddingMm: 6,
  instructionsLineMm: 5,
  /** Characters per instruction line before it wraps — matches the rendered column. */
  instructionsWrapChars: 95,
  /** "Q4 · Long answer" heading above a question's first answer. */
  questionHeadingMm: 8,
  /** The "Q4(a) — 3 marks" row above an answer box. */
  answerLabelMm: 6,
  /** Padding inside an answer box, top and bottom combined. */
  answerBoxPaddingMm: 4,
  /** Spacing between one ruled writing line and the next. */
  linePitchMm: 8,
  /**
   * Height of one MCQ bubble row — the row PITCH, not the bubble.
   *
   * A uniform pitch is what lets a timing mark stand for each row, so this is the one spacing
   * that must never vary. 9mm leaves 4mm clear around a 5mm bubble — tight enough that a
   * 12-question MCQ does not waste half a page, wide enough that two rows cannot merge.
   */
  bubbleRowMm: 9,
  /** Bubble diameter. OMR guidance is ≈3mm minimum; 5mm is comfortably fillable in a hurry. */
  bubbleDiameterMm: 5,
  /** Gap between bubbles in a row. Uniform spacing is what keeps a scanner from misreading. */
  bubbleGapMm: 6,
  /**
   * Width of the number column on a bubble row, so every bubble sits on the same vertical line
   * down the page. Sized for the longest label a bubble row can carry — "viii." — and no wider:
   * whatever this column takes is taken from the bubbles beside it.
   */
  bubbleLabelWidthMm: 16,
  /** Timing mark printed in the margin beside each bubble row — the scanner counts these. */
  timingMarkWidthMm: 7,
  timingMarkHeightMm: 3,
  /** Vertical gap between consecutive blocks. */
  blockGapMm: 4,
} as const;

/** Where content may sit on any side: below the header, above the bottom margin. */
const CONTENT_TOP_MM = GEOMETRY.marginMm + GEOMETRY.headerMm;
const CONTENT_BOTTOM_MM = GEOMETRY.pageHeightMm - GEOMETRY.marginMm;
const CONTENT_HEIGHT_MM = CONTENT_BOTTOM_MM - CONTENT_TOP_MM;

/** Fixed vertical cost of an answer box before any lines or bubbles go in it. */
const ANSWER_CHROME_MM = GEOMETRY.answerLabelMm + GEOMETRY.answerBoxPaddingMm;

/** Cost of a question heading including the gap that follows it. */
const HEADING_WITH_GAP_MM = GEOMETRY.questionHeadingMm + GEOMETRY.blockGapMm;

/**
 * Height of the cover block: title, the QR / roll band, one row per remaining detail, and —
 * only when the paper has machine-read questions — the bubble-filling legend.
 */
function coverHeightMm(withLegend: boolean): number {
  return (
    GEOMETRY.coverPaddingMm +
    GEOMETRY.coverTitleMm +
    // the roll-number grid is taller than the QR beside it, so it sets the band's height
    Math.max(ROLL_GRID_MM, GEOMETRY.coverQrMm) +
    GEOMETRY.blockGapMm +
    COVER_FIELD_ROWS.length * GEOMETRY.coverFieldRowMm +
    (withLegend ? GEOMETRY.blockGapMm + GEOMETRY.coverLegendMm : 0)
  );
}

/**
 * The most ruled lines one answer can hold on a side of its own. Smaller when the answer
 * also carries its question's heading, which is why the caller says whether it does.
 */
export function maxLinesPerSide(withHeading: boolean): number {
  const available = CONTENT_HEIGHT_MM - (withHeading ? HEADING_WITH_GAP_MM : 0) - ANSWER_CHROME_MM;
  return Math.max(0, Math.floor(available / GEOMETRY.linePitchMm));
}

/** How many answers of each size are meant to share one side. */
const ANSWERS_PER_SIDE: Record<Exclude<ESheetAnswerSpace, 'two-sides'>, number> = {
  quarter: 4,
  third: 3,
  half: 2,
  full: 1,
};

/**
 * Ruled lines for a share of a side.
 *
 * Sized so the promise holds: four "¼ side" answers really do fit one page. That means paying,
 * out of the side's budget, for the question heading, each answer's own label row and box
 * padding, and the gaps between them — not just dividing the raw line count, which would
 * overflow by an answer's worth of chrome every time.
 *
 * A full side works out at 29 lines, which is exactly one page; 30 would spill onto the next.
 */
export function linesForSpace(space: ESheetAnswerSpace): number {
  if (space === 'two-sides') return 2 * linesForSpace('full');
  const perSide = ANSWERS_PER_SIDE[space];
  const shared = CONTENT_HEIGHT_MM - HEADING_WITH_GAP_MM - (perSide - 1) * GEOMETRY.blockGapMm;
  const each = shared / perSide - ANSWER_CHROME_MM;
  return Math.max(1, Math.floor(each / GEOMETRY.linePitchMm));
}

/** The space an answer actually gets: its own override, else its question's default. */
export function spaceForAnswer(
  question: Pick<ESheetTemplateQuestion, 'defaultSpace'>,
  answer: Pick<ESheetTemplateAnswer, 'space'>,
): ESheetAnswerSpace {
  return answer.space ?? question.defaultSpace ?? DEFAULT_ANSWER_SPACE;
}

/** Height of the roll-number grid: caption, write-in boxes, then ten 0–9 bubble rows. */
const ROLL_GRID_MM =
  GEOMETRY.coverRollLabelMm + GEOMETRY.coverRollBoxMm + 10 * GEOMETRY.coverRollBubbleRowMm;

/** Digit columns on the roll-number grid. */
export const ROLL_NUMBER_DIGITS = 8;

/** Round to 6 decimals so fractions stay stable across JSON round-trips and assertions. */
function fraction(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** A full-width block at `topMm`, `heightMm` tall, as page fractions. */
function rectAt(topMm: number, heightMm: number): ESheetRect {
  return {
    x: fraction(GEOMETRY.marginMm / GEOMETRY.pageWidthMm),
    y: fraction(topMm / GEOMETRY.pageHeightMm),
    width: fraction((GEOMETRY.pageWidthMm - 2 * GEOMETRY.marginMm) / GEOMETRY.pageWidthMm),
    height: fraction(heightMm / GEOMETRY.pageHeightMm),
  };
}

/** Height of the instructions block, or 0 when there is nothing to print. */
export function instructionsHeightMm(text: string | undefined): number {
  const trimmed = text?.trim() ?? '';
  if (trimmed === '') return 0;
  const lineCount = trimmed.split(/\r?\n/).reduce((sum, line) => {
    const length = line.trim().length;
    return sum + Math.max(1, Math.ceil(length / GEOMETRY.instructionsWrapChars));
  }, 0);
  return GEOMETRY.instructionsPaddingMm + lineCount * GEOMETRY.instructionsLineMm;
}

/** Height of one answer box: a bubble row for MCQ, otherwise its ruled lines. */
function answerHeightMm(question: ESheetTemplateQuestion, lines: number): number {
  // A bubble row carries its own number inline, so it pays no label row — the block IS the row,
  // which is what keeps the grid on one uniform pitch.
  if (!questionTypeUsesLines(question.type)) return GEOMETRY.bubbleRowMm;
  return ANSWER_CHROME_MM + lines * GEOMETRY.linePitchMm;
}

/**
 * Split an oversized line count into whole-side slices. The first slice may be shorter
 * because it carries the question heading.
 */
function sliceLines(lines: number, firstWithHeading: boolean): number[] {
  const slices: number[] = [];
  let remaining = lines;
  let first = true;
  while (remaining > 0) {
    const capacity = maxLinesPerSide(first && firstWithHeading);
    if (capacity <= 0) break; // unreachable with GEOMETRY; guards against a bad tune
    const take = Math.min(remaining, capacity);
    slices.push(take);
    remaining -= take;
    first = false;
  }
  return slices;
}

/** Mutable page being filled. */
interface PageBuilder {
  pageNumber: number;
  blocks: ESheetBlock[];
  /** Next free millimetre from the top of the page. */
  cursorMm: number;
  /** True once a question heading or answer has landed — page-1 chrome does not count. */
  hasQuestionContent: boolean;
}

export function layoutTemplate(template: ESheetTemplate): ESheetLayout {
  const pages: PageBuilder[] = [];

  const startPage = (): PageBuilder => {
    const page: PageBuilder = {
      pageNumber: pages.length + 1,
      blocks: [],
      cursorMm: CONTENT_TOP_MM,
      hasQuestionContent: false,
    };
    pages.push(page);
    return page;
  };

  let page = startPage();

  // ---- page 1: the information cover, and nothing else ----
  const hasMachineRead = template.questions.some(
    (q) => !questionTypeUsesLines(q.type) && q.answers.length > 0,
  );
  const coverMm = coverHeightMm(hasMachineRead);
  page.blocks.push({
    kind: 'cover',
    rect: rectAt(page.cursorMm, coverMm),
    fields: [...COVER_FIELDS],
    hasQr: true,
    rollNumberDigits: ROLL_NUMBER_DIGITS,
    showsMarkingLegend: hasMachineRead,
  });
  page.cursorMm += coverMm + GEOMETRY.blockGapMm;

  const instructionsMm = instructionsHeightMm(template.instructions);
  if (instructionsMm > 0) {
    page.blocks.push({
      kind: 'instructions',
      rect: rectAt(page.cursorMm, instructionsMm),
      text: template.instructions?.trim() ?? '',
    });
    page.cursorMm += instructionsMm + GEOMETRY.blockGapMm;
  }

  const remainingMm = (): number => CONTENT_BOTTOM_MM - page.cursorMm;

  const placeHeading = (question: ESheetTemplateQuestion): void => {
    page.blocks.push({
      kind: 'question-heading',
      rect: rectAt(page.cursorMm, GEOMETRY.questionHeadingMm),
      questionNo: question.questionNo,
      type: question.type,
    });
    page.cursorMm += HEADING_WITH_GAP_MM;
    page.hasQuestionContent = true;
  };

  let answerCount = 0;
  let totalMarks = 0;

  for (const question of template.questions) {
    const answers = question.answers;
    // A question with no answers prints nothing — never an orphan heading.
    if (answers.length === 0) continue;

    const optionCount = question.optionCount ?? DEFAULT_MCQ_OPTION_COUNT;
    const usesLines = questionTypeUsesLines(question.type);
    // Numbering belongs to the question: one paper often mixes "1(a)" with "2(i)".
    const labelStyle = question.subPartLabelStyle ?? 'alpha';

    // Every question starts its own side, and none of them shares the cover — so the first
    // question opens page 2. A template with no questions is left as a cover alone.
    if (page.hasQuestionContent || page.pageNumber === 1) page = startPage();

    answers.forEach((answer, index) => {
      answerCount += 1;
      totalMarks += answer.maxMarks;

      // A bubble row is numbered inside its question — "i." — because the heading above the grid
      // already carries the question number. A written answer is cropped out and marked alone, so
      // it carries the full "Q. No. 4 Part (i)".
      const label = usesLines
        ? answerLabel(question.questionNo, index, answers.length, labelStyle)
        : mcqAnswerLabel(index, labelStyle);
      const carriesHeading = index === 0;
      const lines = usesLines ? linesForSpace(spaceForAnswer(question, answer)) : 0;

      const push = (heightMm: number, slice?: { index: number; total: number }): void => {
        const block: ESheetAnswerBlock = {
          kind: 'answer',
          rect: rectAt(page.cursorMm, heightMm),
          answerId: answer.id,
          questionNo: question.questionNo,
          label,
          maxMarks: answer.maxMarks,
          content: usesLines
            ? {
                kind: 'writing',
                lineCount: Math.round((heightMm - ANSWER_CHROME_MM) / GEOMETRY.linePitchMm),
              }
            : { kind: 'bubbles', optionCount },
          ...(slice ? { continuation: slice } : {}),
        };
        page.blocks.push(block);
        // Bubble rows butt up against each other so the grid keeps ONE uniform pitch — a
        // scanner counts timing marks at a fixed spacing, and a gap between rows both breaks
        // that and wastes half the page on a 12-question MCQ.
        page.cursorMm += heightMm + (usesLines ? GEOMETRY.blockGapMm : 0);
        page.hasQuestionContent = true;
      };

      // Does the answer fit on a side of its own? If not it is split across whole sides.
      const fitsOneSide = !usesLines || lines <= maxLinesPerSide(carriesHeading);

      if (fitsOneSide) {
        const needed = (carriesHeading ? HEADING_WITH_GAP_MM : 0) + answerHeightMm(question, lines);
        // Move the whole thing down rather than straddle the break.
        if (needed > remainingMm()) page = startPage();
        if (carriesHeading) placeHeading(question);
        push(answerHeightMm(question, lines));
        return;
      }

      const slices = sliceLines(lines, carriesHeading);
      slices.forEach((sliceLineCount, sliceIndex) => {
        // An oversized answer always begins a fresh side; each later slice takes its own.
        if (sliceIndex > 0 || page.cursorMm > CONTENT_TOP_MM) page = startPage();
        if (carriesHeading && sliceIndex === 0) placeHeading(question);
        push(answerHeightMm(question, sliceLineCount), {
          index: sliceIndex + 1,
          total: slices.length,
        });
      });
    });
  }

  const finished: ESheetPage[] = pages.map((p) => ({
    pageNumber: p.pageNumber,
    blocks: p.blocks,
  }));

  return { pages: finished, answerCount, totalMarks };
}

/** The smallest rectangle containing both. Used to merge a question's bubble rows into one. */
function unionRect(a: ESheetRect, b: ESheetRect): ESheetRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x: fraction(x),
    y: fraction(y),
    width: fraction(Math.max(a.x + a.width, b.x + b.width) - x),
    height: fraction(Math.max(a.y + a.height, b.y + b.height) - y),
  };
}

/**
 * The crop rectangles the scanner needs, flattened out of the pages.
 *
 * Written answers segment one-for-one — one region per answer slice, so an answer spanning
 * two sides appears twice with its continuation set.
 *
 * MCQ sub-parts do NOT segment individually: a question's bubble rows on one page are merged
 * into a single region covering the whole grid. The OMR reader needs to find the grid; no
 * individual bubble row is ever cropped, which is also why nothing is drawn around one.
 */
export function layoutRegions(layout: ESheetLayout): ESheetRegion[] {
  const regions: ESheetRegion[] = [];

  for (const page of layout.pages) {
    /** Bubble grids being accumulated on this page, keyed by question number. */
    const grids = new Map<number, ESheetRegion>();

    for (const block of page.blocks) {
      if (block.kind !== 'answer') continue;

      if (block.content.kind === 'bubbles') {
        const existing = grids.get(block.questionNo);
        if (existing) {
          existing.answerIds.push(block.answerId);
          existing.maxMarks += block.maxMarks;
          existing.rect = unionRect(existing.rect, block.rect);
        } else {
          grids.set(block.questionNo, {
            pageNumber: page.pageNumber,
            answerIds: [block.answerId],
            questionNo: block.questionNo,
            label: `Q. No. ${block.questionNo}`,
            maxMarks: block.maxMarks,
            contentKind: 'bubbles',
            rect: block.rect,
          });
        }
        continue;
      }

      regions.push({
        pageNumber: page.pageNumber,
        answerIds: [block.answerId],
        questionNo: block.questionNo,
        label: block.label,
        maxMarks: block.maxMarks,
        contentKind: 'writing',
        rect: block.rect,
        ...(block.continuation ? { continuation: block.continuation } : {}),
      });
    }

    regions.push(...grids.values());
  }

  return regions;
}

/**
 * What a chosen share of a side works out as, shown beside the picker in the form.
 *
 * The examiner picks a fraction; this tells them what it buys, so the abstraction never hides
 * the consequence. An earlier version asked for a raw line count and then described 6 lines as
 * "≈ ¼ side" when 6 of 30 is a fifth — a made-up number is worse than no number.
 */
export function spaceSummary(space: ESheetAnswerSpace): string {
  const lines = linesForSpace(space);
  const sides = space === 'two-sides' ? 2 : 1;
  return sides === 1 ? `${lines} lines` : `${lines} lines · ${sides} sides`;
}
