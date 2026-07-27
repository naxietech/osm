/**
 * ESheetPreview (organism) — the printed answer sheet, on screen.
 *
 * Renders every page the layout engine produced, at true A4 proportions, so the examiner sees the
 * sheet as it will print: the information cover, then corner registration marks, a page barcode,
 * MCQ bubble rows and ruled writing lines.
 *
 * Written answers carry corner brackets, because each one is a crop region the scanner cuts out —
 * drawn rather than implied, so what you see is what gets segmented. MCQ rows carry nothing around
 * them (they are read as one grid, never cropped) but do carry a timing mark in the margin, which
 * is what an OMR reader counts to locate each row.
 *
 * Positioning comes straight from the engine's rectangles, which are fractions of the page,
 * so the preview and the stored crop coordinates cannot drift apart. Text is sized in `cqw`
 * (container-query width) units so everything scales with the page rather than the viewport
 * — the same reason the print output matches.
 *
 * DELIBERATE EXCEPTION TO THE DESIGN-TOKEN RULE: inside the sheet the ink is fixed black on
 * fixed white, not `foreground`/`background`. Paper is white in both themes, and a token that
 * flips to near-white in dark mode would render the sheet invisible. Tokens are still used for
 * everything around the sheet (captions, borders, empty state).
 *
 * Purely presentational: it takes a template and draws it. The page owns the data.
 */
import React, { useMemo } from 'react';

import {
  type ESheetAnswerBlock,
  type ESheetCoverField,
  type ESheetQuestionType,
  type ESheetTemplate,
} from '@oses/types';

import { COVER_FIELD_ROWS, GEOMETRY, layoutTemplate } from '@/lib/e-sheet-layout';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<ESheetQuestionType, string> = {
  mcq: 'MCQ',
  'short-answer': 'Short answer',
  'long-answer': 'Long answer',
};

/** Bubble letters: 0 -> A. */
function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Percentage string from a 0–1 fraction. */
function pct(fraction: number): string {
  return `${fraction * 100}%`;
}

/**
 * Millimetres as container-query width units, so anything sized from GEOMETRY prints at its real
 * size and scales with the page rather than the viewport.
 */
function mm(millimetres: number): string {
  return `${(millimetres / GEOMETRY.pageWidthMm) * 100}cqw`;
}

/** Corner registration marks — what the scanner uses to deskew the page. */
function CornerMarks(): React.ReactElement {
  const base = 'absolute h-[2.2cqw] w-[2.2cqw] bg-black';
  return (
    <>
      <span className={cn(base, 'left-[3cqw] top-[3cqw]')} aria-hidden />
      <span className={cn(base, 'right-[3cqw] top-[3cqw]')} aria-hidden />
      <span className={cn(base, 'bottom-[3cqw] left-[3cqw]')} aria-hidden />
      <span className={cn(base, 'bottom-[3cqw] right-[3cqw]')} aria-hidden />
    </>
  );
}

/** The page barcode strip — identifies the template and side to the scanner. */
function PageBarcode({ label }: { label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-[0.8cqw]" aria-hidden>
      <span className="flex h-[2.6cqw] items-end gap-[0.22cqw]">
        {'101101100101101'.split('').map((bit, index) => (
          <span
            key={index}
            className="h-full bg-black"
            style={{ width: bit === '1' ? '0.35cqw' : '0.18cqw' }}
          />
        ))}
      </span>
      <span className="font-mono text-[1.5cqw] tracking-wider text-black">{label}</span>
    </span>
  );
}

/**
 * Ruled writing lines filling the answer box.
 *
 * Each line is a full-height row with its rule at the BOTTOM, so the writing space for a line
 * sits above its rule — which is how people write. Spacing the rules evenly instead (the first
 * version did) put rule one flush against the top of the box with nothing above it, wasting the
 * first line of every answer.
 */
function RuledLines({ count }: { count: number }): React.ReactElement {
  return (
    <div className="flex h-full flex-col px-[2cqw]">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          data-ruled-line
          className="flex-1 border-b border-dotted border-black/45"
        />
      ))}
    </div>
  );
}

/** One bubble, sized from GEOMETRY so it prints at the real OMR diameter. */
function Bubble({ letter }: { letter: string }): React.ReactElement {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-black text-black/70"
      style={{
        width: mm(GEOMETRY.bubbleDiameterMm),
        height: mm(GEOMETRY.bubbleDiameterMm),
        fontSize: mm(GEOMETRY.bubbleDiameterMm * 0.62),
        lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
}

/**
 * One MCQ answer: its number and its bubbles on a single line, the way an OMR sheet is laid out.
 *
 * The number is the sub-part's alone — "i." — not the full "Q. No. 3 Part (i)". The heading above
 * the grid already names the question, and a long label would widen the number column and shove
 * the bubbles across the page.
 *
 * Three things here exist for the scanner rather than the candidate:
 *
 *  - a TIMING MARK in the margin beside every row, which is what the reader counts to find the
 *    vertical position of each row (standard OMR practice);
 *  - a fixed-width number column, so every bubble in the grid sits on the same vertical line
 *    down the whole page — misaligned columns are the classic cause of a misread;
 *  - a uniform bubble diameter and gap taken from GEOMETRY, never eyeballed.
 */
function BubbleRow({
  label,
  optionCount,
  maxMarks,
}: {
  label: string;
  optionCount: number;
  maxMarks: number;
}): React.ReactElement {
  return (
    <div className="relative flex h-full items-center">
      <span
        data-timing-mark
        className="absolute -translate-y-1/2 bg-black"
        style={{
          left: `-${((GEOMETRY.timingMarkWidthMm + 2.5) / GEOMETRY.pageWidthMm) * 100}cqw`,
          top: '50%',
          width: mm(GEOMETRY.timingMarkWidthMm),
          height: mm(GEOMETRY.timingMarkHeightMm),
        }}
        aria-hidden
      />
      <span
        className="shrink-0 font-mono font-semibold text-black"
        style={{ width: mm(GEOMETRY.bubbleLabelWidthMm), fontSize: mm(4.2) }}
      >
        {label}
      </span>
      <span className="flex items-center" style={{ gap: mm(GEOMETRY.bubbleGapMm) }}>
        {Array.from({ length: optionCount }, (_, index) => (
          <Bubble key={index} letter={optionLetter(index)} />
        ))}
      </span>
      {/* Marks are 1 per bubble on almost every paper; only say so when they are not. */}
      {maxMarks !== 1 && (
        <span className="ml-auto text-black/60" style={{ fontSize: mm(3.4) }}>
          {maxMarks} marks
        </span>
      )}
    </div>
  );
}

/**
 * Corner brackets marking a crop area — the four L-shaped registration marks a printer uses
 * for a trim box. Preferred over a full rectangle: the scanner gets four high-contrast corners
 * to lock onto (more reliable than tracing a thin continuous line, which a fold or a staple
 * can break), and the sheet reads as an exam paper rather than a form.
 */
function CropBrackets(): React.ReactElement {
  const arm = 'absolute h-[2.6cqw] w-[2.6cqw] border-black';
  return (
    <span data-crop-marks className="pointer-events-none absolute inset-0" aria-hidden>
      <span className={cn(arm, 'left-0 top-0 border-l-2 border-t-2')} />
      <span className={cn(arm, 'right-0 top-0 border-r-2 border-t-2')} />
      <span className={cn(arm, 'bottom-0 left-0 border-b-2 border-l-2')} />
      <span className={cn(arm, 'bottom-0 right-0 border-b-2 border-r-2')} />
    </span>
  );
}

/**
 * One answer: its label row, then its content.
 *
 * A written answer is a crop region, so it carries corner brackets. MCQ bubble rows are NOT
 * segmented individually — the OMR reader finds the whole grid, and no single row is ever
 * cropped — so nothing is drawn around them.
 */
function AnswerBlock({
  block,
  withSeparator,
}: {
  block: ESheetAnswerBlock;
  /** Rule off the foot of this answer when another one follows it on the same page. */
  withSeparator: boolean;
}): React.ReactElement {
  // An MCQ is one line: number and bubbles together, no label row above it and nothing drawn
  // around it, because a bubble row is never cropped.
  if (block.content.kind === 'bubbles') {
    return (
      <BubbleRow
        label={block.label}
        optionCount={block.content.optionCount}
        maxMarks={block.maxMarks}
      />
    );
  }

  const blockHeightMm = block.rect.height * GEOMETRY.pageHeightMm;
  const labelPercent = (GEOMETRY.answerLabelMm / blockHeightMm) * 100;

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col',
        // A dotted rule off the foot of the answer, in the gap before the next one — so a
        // candidate can see where one answer's space ends and the next begins.
        withSeparator && 'border-b border-dashed border-black/30',
      )}
    >
      <div
        className="flex items-center justify-between text-[1.7cqw] leading-none"
        style={{ flex: `0 0 ${labelPercent}%` }}
      >
        <span className="font-semibold text-black">
          {block.label}
          {block.continuation && (
            <span className="font-normal text-black/60">
              {' '}
              (continued {block.continuation.index} of {block.continuation.total})
            </span>
          )}
        </span>
        <span className="text-black/60">
          {block.maxMarks} mark{block.maxMarks === 1 ? '' : 's'}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <CropBrackets />
        <RuledLines count={block.content.lineCount} />
      </div>
    </div>
  );
}

const COVER_FIELD_LABELS: Record<ESheetCoverField, string> = {
  'roll-number': 'Roll No',
  school: 'School / Institute',
  class: 'Class',
  subject: 'Subject',
  'student-name': 'Candidate Name',
  date: 'Date',
};

/**
 * The roll-number grid — a write-in box per digit above a 0–9 bubble column.
 *
 * The standard OMR arrangement: the candidate pens the digit into the box so a human can read
 * it, then fills the matching bubble below so the scanner can. Neither alone is enough — ink
 * handwriting is not reliably machine-readable, and a bubble column with no written digit gives
 * an invigilator nothing to check against.
 */
function RollNumberGrid({ digits }: { digits: number }): React.ReactElement {
  const columns = Array.from({ length: digits }, (_, index) => index);
  const cellWidth = mm(GEOMETRY.coverRollBoxMm);

  return (
    <div data-roll-grid className="flex w-fit flex-col">
      <span
        className="mb-[0.6cqw] bg-black px-[1cqw] py-[0.4cqw] text-center font-bold uppercase tracking-[0.2em] text-white"
        style={{ fontSize: mm(GEOMETRY.coverRollLabelMm * 0.62) }}
      >
        Roll Number
      </span>

      {/* Write-in boxes: one digit each, in ink. */}
      <div className="flex" aria-hidden>
        {columns.map((column) => (
          <span
            key={column}
            className="border border-black"
            style={{ width: cellWidth, height: mm(GEOMETRY.coverRollBoxMm) }}
          />
        ))}
      </div>

      {/* Ten 0–9 rows beneath, one bubble per digit per column. */}
      <div className="flex border border-t-0 border-black" aria-hidden>
        {columns.map((column) => (
          <span key={column} className="flex flex-col items-center" style={{ width: cellWidth }}>
            {Array.from({ length: 10 }, (_, digit) => (
              <span
                key={digit}
                className="flex items-center justify-center"
                style={{ height: mm(GEOMETRY.coverRollBubbleRowMm) }}
              >
                <Bubble letter={String(digit)} />
              </span>
            ))}
          </span>
        ))}
      </div>

      <span className="mt-[0.5cqw] text-black/55" style={{ fontSize: mm(2.6) }}>
        Write one digit per box, then fill the matching bubble.
      </span>
    </div>
  );
}

/** A labelled detail the invigilator or candidate writes on. */
function CoverField({ field }: { field: ESheetCoverField }): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-1 items-end gap-[1.2cqw]">
      <span
        className="shrink-0 font-medium uppercase tracking-wide text-black/70"
        style={{ fontSize: mm(2.9) }}
      >
        {COVER_FIELD_LABELS[field]}
      </span>
      <span className="min-w-0 flex-1 border-b border-black/40" />
    </div>
  );
}

/**
 * How a bubble must be filled. Printed only when the paper has MCQs.
 *
 * Standard on OMR sheets and not decoration: the reader scores on ink coverage, so a tick, a
 * cross or a half-filled circle can all read as unanswered. Showing the candidate the accepted
 * mark is cheaper than an appeal.
 */
function MarkingLegend(): React.ReactElement {
  const swatch = 'flex shrink-0 items-center justify-center rounded-full border border-black';
  const size = {
    width: mm(GEOMETRY.bubbleDiameterMm),
    height: mm(GEOMETRY.bubbleDiameterMm),
  };
  return (
    <div className="flex items-center gap-[4cqw] border border-black/40 px-[2cqw] py-[1.2cqw]">
      <span
        className="font-semibold uppercase tracking-wide text-black/70"
        style={{ fontSize: mm(2.9) }}
      >
        Filling a bubble
      </span>
      <span className="flex items-center gap-[1.4cqw]" style={{ fontSize: mm(3.1) }}>
        <span className={swatch} style={{ ...size, background: '#000' }} aria-hidden />
        <span className="text-black">Correct</span>
      </span>
      <span className="flex items-center gap-[1.4cqw]" style={{ fontSize: mm(3.1) }}>
        <span className={swatch} style={size} aria-hidden>
          <span className="block h-1/2 w-1/2 rounded-full bg-black" />
        </span>
        <span className={swatch} style={size} aria-hidden>
          <span className="block h-[1px] w-full rotate-45 bg-black" />
        </span>
        <span className="text-black">Not counted</span>
      </span>
    </div>
  );
}

/**
 * The information cover — page 1 in full.
 *
 * Everything identifying sits here and nowhere else, which is what makes a cropped answer
 * anonymous: no answer page carries a name, a roll number or a school.
 *
 * The shape follows how exam boards lay out an answer-booklet cover: a title band, the machine-
 * readable identity block set apart at the top with an explicit "do not write here" warning, then
 * the written details on ruled lines, and the roll number in one-digit-per-box cells so a scanner
 * (and a human) reads the same digits.
 */
function CoverBlock({
  fields,
  hasQr,
  rollNumberDigits,
  showsMarkingLegend,
  rows,
}: {
  fields: ESheetCoverField[];
  hasQr: boolean;
  rollNumberDigits: number;
  showsMarkingLegend: boolean;
  rows: readonly (readonly ESheetCoverField[])[];
}): React.ReactElement {
  return (
    <div className="flex h-full w-full flex-col border-2 border-black">
      {/* Title band */}
      <div className="flex items-baseline justify-between border-b-2 border-black px-[2.5cqw] py-[1.2cqw]">
        <h2
          className="font-bold uppercase tracking-[0.25em] text-black"
          style={{ fontSize: mm(4.4) }}
        >
          Answer Sheet
        </h2>
        <span className="uppercase tracking-widest text-black/50" style={{ fontSize: mm(2.6) }}>
          Candidate details
        </span>
      </div>

      {/* Machine-readable band: roll-number cells and the QR panel */}
      <div className="flex items-stretch gap-[3cqw] border-b border-black/30 px-[2.5cqw] py-[1.6cqw]">
        <div className="flex flex-1 flex-col items-start gap-[0.8cqw]">
          {fields.includes('roll-number') && <RollNumberGrid digits={rollNumberDigits} />}
        </div>
        {hasQr && (
          <div className="flex shrink-0 flex-col items-center gap-[0.8cqw]">
            <div
              className="flex items-center justify-center border border-black"
              style={{
                width: mm(GEOMETRY.coverQrMm),
                height: mm(GEOMETRY.coverQrMm),
                fontSize: mm(3),
              }}
            >
              <span className="text-black/50">QR</span>
            </div>
            <span
              className="text-center font-medium uppercase tracking-wide text-black/60"
              style={{ fontSize: mm(2.4) }}
            >
              Do not write here
            </span>
          </div>
        )}
      </div>

      {/* Written details */}
      <div className="flex flex-1 flex-col justify-center gap-[2.4cqw] px-[2.5cqw] py-[1.6cqw]">
        {rows.map((row, index) => (
          <div key={index} className="flex items-end gap-[4cqw]">
            {row.map((field) => (
              <CoverField key={field} field={field} />
            ))}
          </div>
        ))}
      </div>

      {showsMarkingLegend && (
        <div className="px-[2.5cqw] pb-[1.6cqw]">
          <MarkingLegend />
        </div>
      )}
    </div>
  );
}

export interface ESheetPreviewProps {
  /** The template to draw. Null renders the empty state (nothing to preview yet). */
  template: ESheetTemplate | null;
  className?: string;
}

export function ESheetPreview({ template, className }: ESheetPreviewProps): React.ReactElement {
  const layout = useMemo(() => (template ? layoutTemplate(template) : null), [template]);

  if (!template || !layout) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        Fill in the questions to see the printed sheet.
      </div>
    );
  }

  const total = layout.pages.length;

  return (
    <div className={cn('space-y-6', className)}>
      <p className="text-xs text-muted-foreground print:hidden">
        {total} page{total === 1 ? '' : 's'} · {layout.answerCount} answer
        {layout.answerCount === 1 ? '' : 's'} · {layout.totalMarks} marks. Corner brackets mark the
        areas the scanner cuts out; MCQ bubbles are read as one grid and are not cut.
      </p>

      <div className="esheet-print-root space-y-6">
        {layout.pages.map((page) => (
          <figure key={page.pageNumber} className="space-y-2">
            <figcaption className="text-xs font-medium text-muted-foreground print:hidden">
              Page {page.pageNumber} of {total}
            </figcaption>

            <div
              className="esheet-page relative mx-auto w-full max-w-[46rem] bg-white shadow-sm ring-1 ring-border print:max-w-none print:shadow-none print:ring-0"
              style={{ containerType: 'inline-size', aspectRatio: '210 / 297' }}
            >
              <CornerMarks />

              {/* Page chrome: barcode on the left, page number on the right. */}
              <div className="absolute left-[7.1cqw] right-[7.1cqw] top-[5.1cqw] flex items-center justify-between">
                <PageBarcode label={`P${page.pageNumber}`} />
                <span className="text-[1.6cqw] text-black/80">
                  Page {page.pageNumber} of {total}
                </span>
              </div>

              {page.blocks.map((block, index) => (
                <div
                  key={
                    block.kind === 'answer'
                      ? `${block.answerId}-${index}`
                      : `${block.kind}-${index}`
                  }
                  className="absolute"
                  style={{
                    left: pct(block.rect.x),
                    top: pct(block.rect.y),
                    width: pct(block.rect.width),
                    height: pct(block.rect.height),
                  }}
                >
                  {block.kind === 'cover' && (
                    <CoverBlock
                      fields={block.fields}
                      hasQr={block.hasQr}
                      rollNumberDigits={block.rollNumberDigits}
                      showsMarkingLegend={block.showsMarkingLegend}
                      rows={COVER_FIELD_ROWS}
                    />
                  )}

                  {block.kind === 'instructions' && (
                    <div className="h-full w-full border border-black/50 px-[2cqw] py-[1cqw]">
                      <p className="text-[1.35cqw] font-semibold uppercase tracking-wide text-black/70">
                        Instructions
                      </p>
                      <p className="whitespace-pre-line text-[1.5cqw] leading-[1.7] text-black/90">
                        {block.text}
                      </p>
                    </div>
                  )}

                  {block.kind === 'question-heading' && (
                    <div className="flex h-full w-full items-center gap-[1.5cqw] border-b border-black/60 text-[1.9cqw] leading-none">
                      <span className="font-bold text-black">Q. No. {block.questionNo}</span>
                      <span className="text-black/70">{TYPE_LABELS[block.type]}</span>
                    </div>
                  )}

                  {block.kind === 'answer' && (
                    <AnswerBlock
                      block={block}
                      withSeparator={page.blocks[index + 1]?.kind === 'answer'}
                    />
                  )}
                </div>
              ))}
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default ESheetPreview;
