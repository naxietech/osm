import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type CreateExamDto } from '@oses/types';

import { ExamForm } from './exam-form';

const baseProps = {
  levelOptions: [{ value: 'lvl_9', label: 'Class 9' }],
  groupOptionsByLevel: { lvl_9: [{ value: 'grp_sci', label: 'Science' }] },
  subgroupOptionsByLevelGroup: {},
  subjectOptions: [
    { value: 'sub_bio', label: 'Biology' },
    { value: 'sub_chem', label: 'Chemistry' },
  ],
  instituteOptions: [{ value: 'sch_001', label: 'Government High School Gulberg' }],
  isSubmitting: false,
  mode: 'create' as const,
  onCancel: vi.fn(),
};

/** Everything the schema needs except the dynamic fields under test. */
const filled: Partial<CreateExamDto> = {
  code: 'EX-1',
  name: 'Annual Exam',
  session: '2026',
  levelId: 'lvl_9',
  groupId: 'grp_sci',
  shift: 'morning',
  registrationOpensAt: '2026-01-01',
  registrationClosesAt: '2026-02-01',
  examCompletedDate: '2026-03-01',
};

const submit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /Create Exam/i }));
};

// The dynamic fields (subjects, institute scope) are Formik-owned, so the schema — not
// an imperative check inside onSubmit — decides whether the form may be submitted.
describe('ExamForm dynamic fields', () => {
  it('refuses to submit with no subject selected, and says why', async () => {
    const onSubmit = vi.fn();
    render(<ExamForm {...baseProps} initialValues={filled} onSubmit={onSubmit} />);

    submit();

    expect(await screen.findByText(/at least one subject/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits once a subject is selected', async () => {
    const onSubmit = vi.fn();
    render(
      <ExamForm
        {...baseProps}
        initialValues={{ ...filled, subjectIds: ['sub_bio'] }}
        onSubmit={onSubmit}
      />,
    );

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const dto = onSubmit.mock.calls[0]?.[0] as CreateExamDto | undefined;
    expect(dto?.subjectIds).toEqual(['sub_bio']);
    // One compulsory paper is derived per chosen subject.
    expect(dto?.papers).toHaveLength(1);
  });

  it('requires at least one institute when the scope is "selected"', async () => {
    const onSubmit = vi.fn();
    render(
      <ExamForm
        {...baseProps}
        initialValues={{ ...filled, subjectIds: ['sub_bio'], instituteScope: 'selected' }}
        onSubmit={onSubmit}
      />,
    );

    submit();

    expect(await screen.findByText(/at least one institute/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not demand institutes when the scope is "all"', async () => {
    const onSubmit = vi.fn();
    render(
      <ExamForm
        {...baseProps}
        initialValues={{ ...filled, subjectIds: ['sub_bio'], instituteScope: 'all' }}
        onSubmit={onSubmit}
      />,
    );

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const dto = onSubmit.mock.calls[0]?.[0] as CreateExamDto | undefined;
    expect(dto?.instituteScope).toBe('all');
    expect(dto?.instituteIds).toBeUndefined();
  });
});
