import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from './input';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter value" />);
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
  });

  it('calls onChange with correct value when typed', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('applies error border class when error is true', () => {
    render(<Input error placeholder="field" />);
    expect(screen.getByPlaceholderText('field')).toHaveClass('border-red-500');
  });

  it('does not apply error class when error is false', () => {
    render(<Input placeholder="field" />);
    expect(screen.getByPlaceholderText('field')).not.toHaveClass('border-red-500');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="field" />);
    expect(screen.getByPlaceholderText('field')).toBeDisabled();
  });
});
