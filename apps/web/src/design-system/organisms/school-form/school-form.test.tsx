import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SchoolForm } from './school-form';

const defaultProps = {
  onSubmit: vi.fn(),
  isSubmitting: false,
  mode: 'create' as const,
};

describe('SchoolForm', () => {
  it('renders all five fields', () => {
    render(<SchoolForm {...defaultProps} />);
    expect(screen.getByLabelText(/School Code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/School Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/City/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact Phone/i)).toBeInTheDocument();
  });

  it('submits with correct values when form is filled and submitted', () => {
    const handleSubmit = vi.fn();
    render(<SchoolForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText(/School Code/i), { target: { value: 'ISB-001' } });
    fireEvent.change(screen.getByLabelText(/School Name/i), { target: { value: 'Test School' } });
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Islamabad' } });
    fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'test@school.pk' } });
    fireEvent.change(screen.getByLabelText(/Contact Phone/i), { target: { value: '+92-51-1234567' } });

    fireEvent.click(screen.getByText('Create School'));

    expect(handleSubmit).toHaveBeenCalledWith({
      schoolCode: 'ISB-001',
      schoolName: 'Test School',
      city: 'Islamabad',
      contactEmail: 'test@school.pk',
      contactPhone: '+92-51-1234567',
    });
  });

  it('disables submit button when isSubmitting is true', () => {
    render(<SchoolForm {...defaultProps} isSubmitting />);
    expect(screen.getByText('Create School').closest('button')).toBeDisabled();
  });

  it('shows schoolCode field as disabled in edit mode', () => {
    render(<SchoolForm {...defaultProps} mode="edit" />);
    expect(screen.getByLabelText(/School Code/i)).toBeDisabled();
  });

  it('pre-fills fields from initialValues', () => {
    render(
      <SchoolForm
        {...defaultProps}
        initialValues={{ schoolName: 'Existing School', city: 'Lahore' }}
      />,
    );
    expect(screen.getByLabelText(/School Name/i)).toHaveValue('Existing School');
    expect(screen.getByLabelText(/City/i)).toHaveValue('Lahore');
  });
});
