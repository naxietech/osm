import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OnboardingStatus } from '@oses/types';

import { StatusBadge } from './status-badge';

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
