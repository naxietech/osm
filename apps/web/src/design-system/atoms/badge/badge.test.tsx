import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies success classes for success variant', () => {
    render(<Badge variant="success">Done</Badge>);
    expect(screen.getByText('Done')).toHaveClass('bg-success-subtle', 'text-success-foreground');
  });

  it('applies error classes for error variant', () => {
    render(<Badge variant="error">Failed</Badge>);
    expect(screen.getByText('Failed')).toHaveClass('bg-danger-subtle', 'text-danger-foreground');
  });
});
