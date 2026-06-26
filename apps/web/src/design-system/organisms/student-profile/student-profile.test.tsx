import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type Student } from '@oses/types';

import { StudentProfile, type StudentResult } from './student-profile';

const RESULTS: StudentResult[] = [
  {
    id: 'res_1',
    exam: 'SSC Part I — Annual 2024',
    obtainedMarks: 462,
    totalMarks: 550,
    grade: 'A',
    status: 'pass',
    declaredOn: '2024-08-20',
  },
];

const STUDENT: Student = {
  id: 'stu_001',
  studentRefId: 'ref-3f8a1c20',
  schoolId: 'sch_001',
  fullName: 'Ali Hassan',
  fatherOrGuardianName: 'Hassan Raza',
  gender: 'male',
  dateOfBirth: '2008-04-12',
  cnicOrBform: '35202-1234567-1',
  fatherOrGuardianCnic: '35202-7654321-9',
  fatherMobile: '03001234567',
  address: 'House 12, Street 5',
  city: 'Lahore',
  district: 'Lahore',
  gradeId: 10,
  section: 'A',
  enrollmentStatus: 'active',
  createdAt: '2025-03-01T08:00:00.000Z',
};

describe('StudentProfile', () => {
  it('renders the student identity and details as read-only values', () => {
    render(<StudentProfile student={STUDENT} schoolName="Government High School Gulberg" />);
    expect(screen.getByText('Ali Hassan')).toBeInTheDocument();
    expect(screen.getByText(/Hassan Raza/)).toBeInTheDocument(); // "s/o Hassan Raza"
    expect(screen.getByText('Government High School Gulberg')).toBeInTheDocument();
    expect(screen.getByText(/Grade 10/)).toBeInTheDocument(); // "Grade 10 · A" chip
    expect(screen.getByText('Active')).toBeInTheDocument();
    // No input fields in profile view.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows a dash for missing optional values', () => {
    render(<StudentProfile student={{ ...STUDENT, studentMobile: undefined }} />);
    // Student's Mobile is empty → rendered as an em dash.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders previous results with marks, percentage and pass/fail', () => {
    render(<StudentProfile student={STUDENT} results={RESULTS} />);
    expect(screen.getByText('SSC Part I — Annual 2024')).toBeInTheDocument();
    expect(screen.getByText('462 / 550')).toBeInTheDocument();
    expect(screen.getAllByText('84%').length).toBeGreaterThan(0); // KPIs + results table
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  it('shows an empty state when there are no results', () => {
    render(<StudentProfile student={STUDENT} />);
    expect(screen.getByText(/no results recorded yet/i)).toBeInTheDocument();
  });

  it('renders an Edit button only when onEdit is provided', () => {
    const onEdit = vi.fn();
    const { rerender } = render(<StudentProfile student={STUDENT} />);
    expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();

    rerender(<StudentProfile student={STUDENT} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
