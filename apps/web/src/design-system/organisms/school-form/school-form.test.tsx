import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SchoolForm } from './school-form';

const defaultProps = {
  onSubmit: vi.fn(),
  isSubmitting: false,
  mode: 'create' as const,
};

/** Opens a custom dropdown by its label and clicks the named option. */
function choose(labelRe: RegExp, optionName: string): void {
  fireEvent.click(screen.getByLabelText(labelRe));
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

/** Fills every required field with valid values. */
function fillValidForm(): void {
  fireEvent.change(screen.getByLabelText(/Institution Code/i), { target: { value: 'ISB-001' } });
  fireEvent.change(screen.getByLabelText(/Institution Name/i), {
    target: { value: 'Test School' },
  });
  fireEvent.change(screen.getByLabelText(/Affiliation No/i), { target: { value: 'REG-123' } });
  choose(/Institution Type/i, 'Government');
  choose(/School Level/i, 'Secondary (SSC / Matric)');
  choose(/Category/i, 'Boys');
  choose(/Province/i, 'Punjab');
  fireEvent.change(screen.getByLabelText(/Address/i), {
    target: { value: 'Street 1, Sector F-8' },
  });
  fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Islamabad' } });
  fireEvent.change(screen.getByLabelText(/Postal Code/i), { target: { value: '44000' } });
  fireEvent.change(screen.getByLabelText(/Contact Person Name/i), {
    target: { value: 'Test Person' },
  });
  fireEvent.change(screen.getByLabelText(/Designation/i), { target: { value: 'Principal' } });
  fireEvent.change(screen.getByLabelText(/Contact Email/i), {
    target: { value: 'test@school.pk' },
  });
  fireEvent.change(screen.getByLabelText(/Contact Phone/i), {
    target: { value: '+92-51-1234567' },
  });
}

describe('SchoolForm', () => {
  it('renders the text fields and dropdowns', () => {
    render(<SchoolForm {...defaultProps} />);
    expect(screen.getByLabelText(/Institution Code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Institution Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Affiliation No/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Institution Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/School Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Province/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact Person Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Designation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact Phone/i)).toBeInTheDocument();
  });

  it('submits the typed DTO when a complete, valid form is submitted', async () => {
    const handleSubmit = vi.fn();
    render(<SchoolForm {...defaultProps} onSubmit={handleSubmit} />);

    fillValidForm();
    fireEvent.click(screen.getByText('Create School'));

    await waitFor(() =>
      expect(handleSubmit).toHaveBeenCalledWith({
        schoolCode: 'ISB-001',
        schoolName: 'Test School',
        registrationNo: 'REG-123',
        institutionType: 'government',
        schoolLevel: 'secondary',
        category: 'boys',
        address: 'Street 1, Sector F-8',
        city: 'Islamabad',
        province: 'punjab',
        postalCode: '44000',
        contactPersonName: 'Test Person',
        contactPersonDesignation: 'Principal',
        contactEmail: 'test@school.pk',
        contactPhone: '+92-51-1234567',
      }),
    );
  });

  it('shows a validation error and does not submit when required fields are empty', async () => {
    const handleSubmit = vi.fn();
    render(<SchoolForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.click(screen.getByText('Create School'));

    await waitFor(() => {
      expect(screen.getByText('School code is required')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('disables submit button when isSubmitting is true', () => {
    render(<SchoolForm {...defaultProps} isSubmitting />);
    expect(screen.getByText('Create School').closest('button')).toBeDisabled();
  });

  it('shows schoolCode field as disabled in edit mode', () => {
    render(<SchoolForm {...defaultProps} mode="edit" />);
    expect(screen.getByLabelText(/Institution Code/i)).toBeDisabled();
  });

  it('pre-fills fields from initialValues', () => {
    render(
      <SchoolForm
        {...defaultProps}
        initialValues={{ schoolName: 'Existing School', city: 'Lahore' }}
      />,
    );
    expect(screen.getByLabelText(/Institution Name/i)).toHaveValue('Existing School');
    expect(screen.getByLabelText(/City/i)).toHaveValue('Lahore');
  });
});
