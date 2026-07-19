import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstituteCategoryForm, type InstituteCategoryFormValue } from './institute-category-form';

const defaultProps = {
  mode: 'create' as const,
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

/** Opens a custom dropdown by its label and clicks the named option. */
function choose(labelRe: RegExp, optionName: string): void {
  fireEvent.click(screen.getByLabelText(labelRe));
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('InstituteCategoryForm', () => {
  it('renders the scalar fields and an empty preview', () => {
    render(<InstituteCategoryForm {...defaultProps} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/Code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Add a question to see the preview/i)).toBeInTheDocument();
  });

  it('blocks save when a choice question has fewer than two options', () => {
    render(<InstituteCategoryForm {...defaultProps} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Code/i), { target: { value: 'SCH' } });
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'School' } });

    fireEvent.click(screen.getByRole('button', { name: /Add Question/i }));
    fireEvent.change(screen.getByLabelText(/Question 1 text/i), {
      target: { value: 'Are you ed-tech?' },
    });
    choose(/Answer type/i, 'Radio (choose one)');

    // Two blank options are seeded → validation fails, save disabled.
    expect(screen.getByText(/Add at least 2 answer options/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Category' })).toBeDisabled();
  });

  it('emits a cleaned value (with the required flag) on save', () => {
    const onSave = vi.fn();
    render(<InstituteCategoryForm {...defaultProps} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Code/i), { target: { value: 'BRD' } });
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Board' } });

    fireEvent.click(screen.getByRole('button', { name: /Add Question/i }));
    fireEvent.change(screen.getByLabelText(/Question 1 text/i), {
      target: { value: 'Affiliation number' },
    });
    fireEvent.click(screen.getByLabelText(/Required/i));

    fireEvent.click(screen.getByRole('button', { name: 'Add Category' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const value = onSave.mock.calls[0]?.[0] as InstituteCategoryFormValue | undefined;
    expect(value).toMatchObject({ code: 'BRD', name: 'Board' });
    expect(value?.questions).toEqual([
      { text: 'Affiliation number', type: 'text', required: true },
    ]);
  });
});
