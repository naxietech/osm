import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type MarkingBandOption } from '@oses/types';

import { MarkingBandSelector, marksForBand } from './marking-band-selector';

const RUBRIC: MarkingBandOption[] = [
  { band: 'correct', marks: 12 },
  { band: 'partially-correct', marks: 8 },
  { band: 'partially-incorrect', marks: 4 },
  { band: 'incorrect', marks: 0 },
];

describe('MarkingBandSelector', () => {
  it('shows the four bands with what each is worth', () => {
    render(<MarkingBandSelector rubric={RUBRIC} onChange={vi.fn()} />);
    for (const option of RUBRIC) {
      const label = {
        correct: 'Correct',
        'partially-correct': 'Partially Correct',
        'partially-incorrect': 'Partially Incorrect',
        incorrect: 'Incorrect',
      }[option.band];
      expect(screen.getByRole('radio', { name: new RegExp('^' + label) })).toHaveTextContent(
        String(option.marks),
      );
    }
  });

  it('marks the chosen band as checked and reports the choice', () => {
    const onChange = vi.fn();
    render(<MarkingBandSelector rubric={RUBRIC} value="correct" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: /^Correct/ })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: /^Incorrect/ }));
    expect(onChange).toHaveBeenCalledWith('incorrect');
  });

  it('marksForBand returns 0 for a band the rubric omits', () => {
    expect(marksForBand([{ band: 'correct', marks: 10 }], 'incorrect')).toBe(0);
  });
});
