import React from 'react';

import { type MarkingBand, type MarkingBandOption } from '@oses/types';

import { Kbd } from '@/design-system/atoms/kbd';
import { cn } from '@/lib/utils';

/** Band order, best → worst. Also the order of the 1–4 keyboard shortcuts. */
export const BAND_ORDER: MarkingBand[] = [
  'correct',
  'partially-correct',
  'partially-incorrect',
  'incorrect',
];

export const BAND_LABEL: Record<MarkingBand, string> = {
  correct: 'Correct',
  'partially-correct': 'Partially Correct',
  'partially-incorrect': 'Partially Incorrect',
  incorrect: 'Incorrect',
};

/** Reserved meanings: green correct, red incorrect, amber partial (both partials amber). */
const BAND_TONE: Record<MarkingBand, { border: string; bg: string; text: string }> = {
  correct: { border: 'border-success', bg: 'bg-success-subtle', text: 'text-success-foreground' },
  'partially-correct': {
    border: 'border-warning',
    bg: 'bg-warning-subtle',
    text: 'text-warning-foreground',
  },
  'partially-incorrect': {
    border: 'border-warning',
    bg: 'bg-warning-subtle',
    text: 'text-warning-foreground',
  },
  incorrect: { border: 'border-danger', bg: 'bg-danger-subtle', text: 'text-danger-foreground' },
};

/** What a band is worth on a given rubric, or 0 if the rubric omits it. */
export function marksForBand(rubric: MarkingBandOption[], band: MarkingBand): number {
  return rubric.find((option) => option.band === band)?.marks ?? 0;
}

export interface MarkingBandSelectorProps {
  rubric: MarkingBandOption[];
  value?: MarkingBand;
  onChange: (band: MarkingBand) => void;
  className?: string;
}

/**
 * The four-band marking scale as a radiogroup, each band showing what it is worth on this
 * rubric. Presentational: it reports the chosen band and never a mark, so the four-band
 * scale cannot be bypassed — the caller looks the marks up in the rubric.
 */
export function MarkingBandSelector({
  rubric,
  value,
  onChange,
  className,
}: MarkingBandSelectorProps): React.ReactElement {
  return (
    <div className={cn('space-y-2', className)} role="radiogroup" aria-label="Marking band">
      {BAND_ORDER.map((band, index) => {
        const tone = BAND_TONE[band];
        const selected = value === band;
        return (
          <button
            key={band}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(band)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
              selected
                ? `${tone.border} ${tone.bg} ${tone.text} font-medium`
                : 'border-border text-foreground hover:bg-muted',
            )}
          >
            <span className="flex-1">{BAND_LABEL[band]}</span>
            <Kbd>{index + 1}</Kbd>
            <span className="w-8 text-right font-semibold tabular-nums">
              {marksForBand(rubric, band)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default MarkingBandSelector;
