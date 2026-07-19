import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type SelectOption } from '@/design-system/molecules/select-field';

import { StudentForm } from './student-form';

const INSTITUTE_OPTIONS: SelectOption[] = [
  { value: 'sch_001', label: 'Institute One' },
  { value: 'sch_002', label: 'Institute Two' },
];

const LEVEL_OPTIONS: SelectOption[] = [
  { value: 'lvl_9', label: 'Class 9' },
  { value: 'lvl_10', label: 'Class 10' },
  { value: 'lvl_12', label: 'Class 12' },
];

const GROUP_OPTIONS_BY_LEVEL: Record<string, SelectOption[]> = {
  lvl_9: [{ value: 'grp_science', label: 'Science' }],
  lvl_10: [{ value: 'grp_science', label: 'Science' }],
  lvl_12: [{ value: 'grp_premed', label: 'Pre-Medical' }],
};

const defaultProps = {
  instituteOptions: INSTITUTE_OPTIONS,
  levelOptions: LEVEL_OPTIONS,
  groupOptionsByLevel: GROUP_OPTIONS_BY_LEVEL,
  onSubmit: vi.fn(),
  isSubmitting: false,
  mode: 'create' as const,
};

/** Opens a custom dropdown by its label and clicks the named option. */
function chooseOption(labelRe: RegExp, optionName: string): void {
  fireEvent.click(screen.getByLabelText(labelRe));
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

/** Fills every required field with valid values. */
function fillRequired(): void {
  chooseOption(/Institute/i, 'Institute One');
  chooseOption(/Class/i, 'Class 10');
  chooseOption(/Group/i, 'Science');
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Test Student' } });
  fireEvent.change(screen.getByLabelText(/Father \/ Guardian Name/i), {
    target: { value: 'Father Name' },
  });
  fireEvent.change(screen.getByLabelText(/Father \/ Guardian CNIC/i), {
    target: { value: '35202-1234567-1' },
  });
  chooseOption(/Gender/i, 'Male');
  fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: '2008-04-12' } });
  fireEvent.change(screen.getByLabelText(/Father's Mobile/i), { target: { value: '03001234567' } });
  fireEvent.change(screen.getByLabelText(/^Address/i), { target: { value: 'House 1, Street 2' } });
  fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Lahore' } });
  fireEvent.change(screen.getByLabelText(/District/i), { target: { value: 'Lahore' } });
}

describe('StudentForm', () => {
  it('renders the grouped fields', () => {
    render(<StudentForm {...defaultProps} />);
    expect(screen.getByLabelText(/Institute/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Class/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Group/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Father \/ Guardian Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Father \/ Guardian CNIC/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Student CNIC/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Father's Mobile/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Student's Mobile/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/District/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Postal Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Student Photo/i)).toBeInTheDocument();
  });

  it('submits the typed payload when the required fields are valid', async () => {
    const handleSubmit = vi.fn();
    render(<StudentForm {...defaultProps} onSubmit={handleSubmit} />);

    fillRequired();
    fireEvent.click(screen.getByText('Enrol Student'));

    await waitFor(() =>
      expect(handleSubmit).toHaveBeenCalledWith({
        instituteId: 'sch_001',
        fullName: 'Test Student',
        fatherOrGuardianName: 'Father Name',
        fatherOrGuardianCnic: '35202-1234567-1',
        gender: 'male',
        dateOfBirth: '2008-04-12',
        fatherMobile: '03001234567',
        address: 'House 1, Street 2',
        city: 'Lahore',
        district: 'Lahore',
        levelId: 'lvl_10',
        groupId: 'grp_science',
      }),
    );
  });

  it('shows a validation error and does not submit when required fields are empty', async () => {
    const handleSubmit = vi.fn();
    render(<StudentForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.click(screen.getByText('Enrol Student'));

    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('rejects an invalid student CNIC / B-Form', async () => {
    const handleSubmit = vi.fn();
    render(<StudentForm {...defaultProps} onSubmit={handleSubmit} />);

    fillRequired();
    fireEvent.change(screen.getByLabelText(/Student CNIC/i), { target: { value: '123' } });
    fireEvent.click(screen.getByText('Enrol Student'));

    await waitFor(() => {
      expect(screen.getByText('CNIC / B-Form must be 13 digits')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('rejects an invalid father mobile number', async () => {
    const handleSubmit = vi.fn();
    render(<StudentForm {...defaultProps} onSubmit={handleSubmit} />);

    fillRequired();
    fireEvent.change(screen.getByLabelText(/Father's Mobile/i), { target: { value: '12345' } });
    fireEvent.click(screen.getByText('Enrol Student'));

    await waitFor(() => {
      expect(screen.getByText(/valid mobile number/i)).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('disables submit while submitting', () => {
    render(<StudentForm {...defaultProps} isSubmitting />);
    expect(screen.getByText('Enrol Student').closest('button')).toBeDisabled();
  });

  it('locks the institute field in edit mode', () => {
    render(<StudentForm {...defaultProps} mode="edit" />);
    expect(screen.getByLabelText(/Institute/i)).toBeDisabled();
  });

  it('locks the institute field when lockInstitute is set (institute staff)', () => {
    render(<StudentForm {...defaultProps} lockInstitute />);
    expect(screen.getByLabelText(/Institute/i)).toBeDisabled();
  });

  it('shows the enrollment status only in edit mode', () => {
    const { rerender } = render(<StudentForm {...defaultProps} mode="create" />);
    expect(screen.queryByLabelText(/Enrollment Status/i)).not.toBeInTheDocument();

    rerender(<StudentForm {...defaultProps} mode="edit" />);
    expect(screen.getByLabelText(/Enrollment Status/i)).toBeInTheDocument();
  });

  it('pre-fills fields from initialValues', () => {
    render(
      <StudentForm
        {...defaultProps}
        mode="edit"
        initialValues={{
          fullName: 'Existing Student',
          fatherOrGuardianName: 'Existing Father',
          levelId: 'lvl_12',
          groupId: 'grp_premed',
        }}
      />,
    );
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('Existing Student');
    expect(screen.getByLabelText(/Father \/ Guardian Name/i)).toHaveValue('Existing Father');
    expect(screen.getByLabelText(/^Class/i)).toHaveTextContent('Class 12');
  });
});
