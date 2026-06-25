import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SelectField, type SelectOption } from './select-field';

const OPTIONS: SelectOption[] = [
  { value: 'punjab', label: 'Punjab' },
  { value: 'sindh', label: 'Sindh' },
];

describe('SelectField', () => {
  it('renders the label associated with the select and its options', () => {
    render(<SelectField id="province" label="Province" options={OPTIONS} />);
    expect(screen.getByLabelText('Province')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Punjab' })).toBeInTheDocument();
  });

  it('renders a disabled placeholder option when provided', () => {
    render(
      <SelectField
        id="province"
        label="Province"
        placeholder="Select province"
        options={OPTIONS}
      />,
    );
    expect(screen.getByRole('option', { name: 'Select province' })).toBeDisabled();
  });

  it('calls onChange when an option is selected', () => {
    const onChange = vi.fn();
    render(<SelectField id="province" label="Province" options={OPTIONS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Province'), { target: { value: 'sindh' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applies the error treatment, message and aria wiring on error', () => {
    render(
      <SelectField id="province" label="Province" options={OPTIONS} error="Province is required" />,
    );
    const select = screen.getByLabelText('Province');
    expect(select).toHaveClass('border-danger');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', 'province-error');

    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('Province is required');
    expect(message).toHaveAttribute('id', 'province-error');
  });

  it('renders the required asterisk', () => {
    render(<SelectField id="province" label="Province" options={OPTIONS} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('has no alert or aria-invalid without an error', () => {
    render(<SelectField id="province" label="Province" options={OPTIONS} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Province')).not.toHaveAttribute('aria-invalid');
  });
});
