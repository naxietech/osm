import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from './textarea';

describe('Textarea', () => {
  it('renders a textarea that takes a value', () => {
    render(<Textarea aria-label="Comment" defaultValue="hello" />);
    expect(screen.getByLabelText('Comment')).toHaveValue('hello');
  });

  it('flags itself invalid when error is set', () => {
    render(<Textarea aria-label="Comment" error />);
    expect(screen.getByLabelText('Comment')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when valid', () => {
    render(<Textarea aria-label="Comment" />);
    expect(screen.getByLabelText('Comment')).not.toHaveAttribute('aria-invalid');
  });
});
