import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  MarkingBandBadge,
  MarkingBatchStatusBadge,
  MarkingScriptStatusBadge,
  StatusBadge,
} from './status-badge';

describe('StatusBadge', () => {
  it('shows "Pending" for a pending application', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows "Approved" for an approved institute', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('shows "Deactivated" for a deactivated institute', () => {
    render(<StatusBadge status="deactivated" />);
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
  });

  it('applies warning badge variant for pending', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toHaveClass('bg-warning-subtle');
  });

  it('applies success badge variant for approved', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('Approved')).toHaveClass('bg-success-subtle');
  });

  it('applies error badge variant for deactivated', () => {
    render(<StatusBadge status="deactivated" />);
    expect(screen.getByText('Deactivated')).toHaveClass('bg-danger-subtle');
  });

  it('shows a rejected application as distinct from a deactivated institute', () => {
    // Both are red, because neither is usable — but one never became an institute at all, so
    // the labels must not be interchangeable.
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
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
