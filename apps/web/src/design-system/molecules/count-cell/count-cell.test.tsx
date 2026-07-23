import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CountCell } from './count-cell';

describe('CountCell', () => {
  it('shows an em-dash for zero', () => {
    render(<CountCell value={0} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the number when non-zero', () => {
    render(<CountCell value={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('tints a non-zero warning count', () => {
    render(<CountCell value={3} tone="warning" />);
    expect(screen.getByText('3')).toHaveClass('text-warning-foreground');
  });
});
