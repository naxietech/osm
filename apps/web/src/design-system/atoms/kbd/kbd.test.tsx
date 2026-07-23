import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Kbd } from './kbd';

describe('Kbd', () => {
  it('renders its content inside a kbd element', () => {
    render(<Kbd>Enter</Kbd>);
    const key = screen.getByText('Enter');
    expect(key.tagName).toBe('KBD');
  });

  it('merges a caller class without dropping the base styles', () => {
    render(<Kbd className="ml-2">1</Kbd>);
    const key = screen.getByText('1');
    expect(key).toHaveClass('ml-2');
    expect(key).toHaveClass('font-mono');
  });
});
