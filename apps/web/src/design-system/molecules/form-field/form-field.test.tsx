import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormField } from './form-field';

describe('FormField', () => {
  it('renders the floating label associated with the input', () => {
    render(<FormField id="school-name" label="School Name" />);
    expect(screen.getByLabelText('School Name')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<FormField id="email" label="Email" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applies the red error treatment, message and aria wiring on error', () => {
    render(<FormField id="email" label="Email" error="Email is required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveClass('border-danger', 'bg-danger-subtle');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');

    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('Email is required');
    expect(message).toHaveAttribute('id', 'email-error');
  });

  it('turns the label red on error', () => {
    render(<FormField id="email" label="Email" error="Required" />);
    expect(screen.getByText('Email')).toHaveClass('text-danger');
  });

  it('renders the required asterisk', () => {
    render(<FormField id="email" label="Email" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('has no alert or aria-invalid without an error', () => {
    render(<FormField id="email" label="Email" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });
});
