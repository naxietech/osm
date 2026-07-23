import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LabeledProgress } from './labeled-progress';

describe('LabeledProgress', () => {
  it('renders the bar with a named progressbar and the marked-of-total caption', () => {
    render(<LabeledProgress percent={65} marked={26} total={40} label="Physics" />);
    expect(screen.getByRole('progressbar', { name: /Physics marking progress/ })).toHaveAttribute(
      'aria-valuenow',
      '65',
    );
    expect(screen.getByText('26 of 40 marked')).toBeInTheDocument();
  });
});
