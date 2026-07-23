import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('exposes the value to assistive tech under its label', () => {
    render(<ProgressBar value={65} label="Physics marking progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Physics marking progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '65');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('hides the percentage text unless asked for it', () => {
    const { rerender } = render(<ProgressBar value={40} label="Progress" />);
    expect(screen.queryByText('40%')).not.toBeInTheDocument();

    rerender(<ProgressBar value={40} label="Progress" showValue />);
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  // Percentages arrive from derived data, so a bad one must not paint outside the track.
  it('clamps out-of-range and non-finite values', () => {
    const { rerender } = render(<ProgressBar value={140} label="Progress" showValue />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    rerender(<ProgressBar value={-20} label="Progress" showValue />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    rerender(<ProgressBar value={Number.NaN} label="Progress" showValue />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('rounds fractional percentages', () => {
    render(<ProgressBar value={65.4} label="Progress" showValue />);
    expect(screen.getByText('65%')).toBeInTheDocument();
  });
});
