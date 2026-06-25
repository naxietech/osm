import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './select';

describe('Select', () => {
  it('renders its options', () => {
    render(
      <Select aria-label="picker">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('calls onChange when a different option is selected', () => {
    const handleChange = vi.fn();
    render(
      <Select aria-label="picker" defaultValue="a" onChange={handleChange}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('applies error border class and aria-invalid when error is true', () => {
    render(
      <Select aria-label="picker" error>
        <option value="a">Alpha</option>
      </Select>,
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('border-danger');
    expect(select).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not apply error class when error is false', () => {
    render(
      <Select aria-label="picker">
        <option value="a">Alpha</option>
      </Select>,
    );
    const select = screen.getByRole('combobox');
    expect(select).not.toHaveClass('border-danger');
    expect(select).not.toHaveAttribute('aria-invalid');
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <Select aria-label="picker" disabled>
        <option value="a">Alpha</option>
      </Select>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
