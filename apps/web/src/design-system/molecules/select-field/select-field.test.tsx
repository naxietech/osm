import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SelectField, type SelectOption } from './select-field';

const OPTIONS: SelectOption[] = [
  { value: 'punjab', label: 'Punjab' },
  { value: 'sindh', label: 'Sindh' },
];

describe('SelectField', () => {
  it('renders a labeled combobox that is closed by default', () => {
    render(<SelectField label="Province" options={OPTIONS} value="" onChange={vi.fn()} />);
    const combobox = screen.getByLabelText(/Province/i);
    expect(combobox).toHaveAttribute('role', 'combobox');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the listbox and shows the options on click', () => {
    render(<SelectField label="Province" options={OPTIONS} value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/Province/i));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Punjab' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sindh' })).toBeInTheDocument();
  });

  it('calls onChange with the chosen value and closes', () => {
    const onChange = vi.fn();
    render(<SelectField label="Province" options={OPTIONS} value="" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Province/i));
    fireEvent.click(screen.getByRole('option', { name: 'Sindh' }));
    expect(onChange).toHaveBeenCalledWith('sindh');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the selected option label in the control', () => {
    render(<SelectField label="Province" options={OPTIONS} value="punjab" onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Province/i)).toHaveTextContent('Punjab');
  });

  it('opens and moves with the keyboard, choosing on Enter', () => {
    const onChange = vi.fn();
    render(<SelectField label="Province" options={OPTIONS} value="" onChange={onChange} />);
    const combobox = screen.getByLabelText(/Province/i);
    fireEvent.keyDown(combobox, { key: 'ArrowDown' }); // open (active = 0)
    fireEvent.keyDown(combobox, { key: 'ArrowDown' }); // active = 1
    fireEvent.keyDown(combobox, { key: 'Enter' }); // choose index 1
    expect(onChange).toHaveBeenCalledWith('sindh');
  });

  it('applies the error treatment, message and aria wiring on error', () => {
    render(
      <SelectField
        id="province"
        label="Province"
        options={OPTIONS}
        value=""
        onChange={vi.fn()}
        error="Province is required"
      />,
    );
    const combobox = screen.getByLabelText(/Province/i);
    expect(combobox).toHaveClass('border-danger');
    expect(combobox).toHaveAttribute('aria-invalid', 'true');
    expect(combobox).toHaveAttribute('aria-describedby', 'province-error');

    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('Province is required');
    expect(message).toHaveAttribute('id', 'province-error');
  });

  it('renders the required asterisk', () => {
    render(<SelectField label="Province" options={OPTIONS} value="" onChange={vi.fn()} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<SelectField label="Province" options={OPTIONS} value="" onChange={vi.fn()} disabled />);
    const combobox = screen.getByLabelText(/Province/i);
    expect(combobox).toBeDisabled();
    fireEvent.click(combobox);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
