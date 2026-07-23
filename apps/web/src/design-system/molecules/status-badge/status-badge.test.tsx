import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OnboardingStatus } from '@oses/types';

import {
  MarkingBandBadge,
  MarkingBatchStatusBadge,
  MarkingScriptStatusBadge,
  StatusBadge,
} from './status-badge';

describe('StatusBadge', () => {
  it('shows "Pending" for PENDING status', () => {
    render(<StatusBadge status={OnboardingStatus.PENDING} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows "Complete" for COMPLETE status', () => {
    render(<StatusBadge status={OnboardingStatus.COMPLETE} />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('shows "Suspended" for SUSPENDED status', () => {
    render(<StatusBadge status={OnboardingStatus.SUSPENDED} />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('applies warning badge variant for PENDING', () => {
    render(<StatusBadge status={OnboardingStatus.PENDING} />);
    expect(screen.getByText('Pending')).toHaveClass('bg-warning-subtle');
  });

  it('applies success badge variant for COMPLETE', () => {
    render(<StatusBadge status={OnboardingStatus.COMPLETE} />);
    expect(screen.getByText('Complete')).toHaveClass('bg-success-subtle');
  });

  it('applies error badge variant for SUSPENDED', () => {
    render(<StatusBadge status={OnboardingStatus.SUSPENDED} />);
    expect(screen.getByText('Suspended')).toHaveClass('bg-danger-subtle');
  });

  it('applies info badge variant for IN_PROGRESS', () => {
    render(<StatusBadge status={OnboardingStatus.IN_PROGRESS} />);
    expect(screen.getByText('In Progress')).toHaveClass('bg-info-subtle');
  });
});

describe('MarkingBatchStatusBadge', () => {
  it('labels each batch status', () => {
    const { rerender } = render(<MarkingBatchStatusBadge status="queued" />);
    expect(screen.getByText('Queued')).toBeInTheDocument();

    rerender(<MarkingBatchStatusBadge status="in-progress" />);
    expect(screen.getByText('In progress')).toHaveClass('bg-info-subtle');

    rerender(<MarkingBatchStatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toHaveClass('bg-success-subtle');
  });
});

describe('MarkingScriptStatusBadge', () => {
  it('labels each script status', () => {
    const { rerender } = render(<MarkingScriptStatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();

    rerender(<MarkingScriptStatusBadge status="marked" />);
    expect(screen.getByText('Marked')).toHaveClass('bg-success-subtle');
  });

  // A flag routes work to a supervisor — it is not the checker failing, so amber not red.
  it('shows a flagged script in amber rather than red', () => {
    render(<MarkingScriptStatusBadge status="flagged" />);
    const badge = screen.getByText('Flagged');
    expect(badge).toHaveClass('bg-warning-subtle');
    expect(badge).not.toHaveClass('bg-danger-subtle');
  });
});

describe('MarkingBandBadge', () => {
  it('labels each of the four bands', () => {
    const { rerender } = render(<MarkingBandBadge band="correct" />);
    expect(screen.getByText('Correct')).toBeInTheDocument();

    rerender(<MarkingBandBadge band="partially-correct" />);
    expect(screen.getByText('Partially Correct')).toBeInTheDocument();

    rerender(<MarkingBandBadge band="partially-incorrect" />);
    expect(screen.getByText('Partially Incorrect')).toBeInTheDocument();

    rerender(<MarkingBandBadge band="incorrect" />);
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
  });

  // The project reserves green = correct, red = incorrect, amber = partial. Both partial
  // bands are amber on purpose; this pins that so a future edit cannot quietly recolour it.
  it('follows the reserved colour meanings', () => {
    const { rerender } = render(<MarkingBandBadge band="correct" />);
    expect(screen.getByText('Correct')).toHaveClass('bg-success-subtle');

    rerender(<MarkingBandBadge band="partially-correct" />);
    expect(screen.getByText('Partially Correct')).toHaveClass('bg-warning-subtle');

    rerender(<MarkingBandBadge band="partially-incorrect" />);
    expect(screen.getByText('Partially Incorrect')).toHaveClass('bg-warning-subtle');

    rerender(<MarkingBandBadge band="incorrect" />);
    expect(screen.getByText('Incorrect')).toHaveClass('bg-danger-subtle');
  });
});
