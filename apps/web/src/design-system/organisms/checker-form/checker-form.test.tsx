import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type CreateCheckerDto } from '@oses/types';

import { CheckerForm } from './checker-form';

const baseProps = {
  instituteOptions: [
    { value: 'sch_001', label: 'Government High School Gulberg' },
    { value: 'sch_002', label: 'Government Boys Secondary School Clifton' },
  ],
  subjectOptions: [{ value: 'sub_bio', label: 'Biology' }],
  levelOptions: [{ value: 'lvl_9', label: 'Class 9' }],
  isCnicTaken: () => false,
  onSubmit: vi.fn(),
};

// Formik validates asynchronously, so validity-driven assertions are awaited.
describe('CheckerForm', () => {
  it('lets a super admin choose the checker type', () => {
    render(<CheckerForm {...baseProps} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/General/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/School-specific/i)).toBeInTheDocument();
  });

  it('opens clean — no field complains before the user has touched anything', async () => {
    render(<CheckerForm {...baseProps} onSubmit={vi.fn()} lockedInstituteId="sch_002" />);
    // validateOnMount is on so the submit button can gate correctly; that must not leak
    // into the UI as errors on a blank form.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Submit for Approval/i })).toBeDisabled(),
    );
    expect(screen.queryByText(/Select at least one subject/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Select at least one class/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Attach the qualification certificate/i)).not.toBeInTheDocument();
  });

  it('complains about an emptied multi-select once the user has engaged with it', async () => {
    render(<CheckerForm {...baseProps} onSubmit={vi.fn()} lockedInstituteId="sch_002" />);
    const trigger = screen
      .getByText('Subjects')
      .closest('.relative')
      ?.querySelector('[role="button"]');
    fireEvent.click(trigger as Element);
    // Select, then Clear -> the field has been engaged with, so the message is warranted.
    // Only one 'Biology' exists until it is picked (then a chip appears too).
    fireEvent.click(await screen.findByText('Biology'));
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }));
    expect(await screen.findByText(/Select at least one subject/i)).toBeInTheDocument();
  });

  it('shows the institute picker only for a school-specific checker', async () => {
    render(<CheckerForm {...baseProps} onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/Institute/i, { selector: 'button' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/School-specific/i));
    expect(await screen.findByLabelText(/Institute/i, { selector: 'button' })).toBeInTheDocument();
  });

  it('hides the classification choice entirely for an institute user', () => {
    render(<CheckerForm {...baseProps} onSubmit={vi.fn()} lockedInstituteId="sch_002" />);
    // No way to pick a type or a different school — the binding is not user input.
    expect(screen.queryByLabelText(/General/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/School-specific/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Institute/i, { selector: 'button' })).not.toBeInTheDocument();
    expect(screen.getByText(/registered to your institute/i)).toBeInTheDocument();
  });

  it('flags a CNIC that is already registered', async () => {
    render(
      <CheckerForm
        {...baseProps}
        onSubmit={vi.fn()}
        isCnicTaken={(cnic) => cnic === '35202-1234567-1'}
      />,
    );
    fireEvent.change(screen.getByLabelText(/CNIC/i, { selector: '#cnic' }), {
      target: { value: '35202-1234567-1' },
    });
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });

  it('requires the qualification certificate before it can be submitted', async () => {
    render(<CheckerForm {...baseProps} onSubmit={vi.fn()} lockedInstituteId="sch_002" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Submit for Approval/i })).toBeDisabled(),
    );
  });

  it('emits a school-bound dto for an institute user', async () => {
    const onSubmit = vi.fn();
    render(<CheckerForm {...baseProps} onSubmit={onSubmit} lockedInstituteId="sch_002" />);

    const typeIn = (el: HTMLElement, value: string): void => {
      fireEvent.change(el, { target: { value } });
    };
    const type = (label: RegExp, value: string): void => {
      typeIn(screen.getByLabelText(label), value);
    };
    type(/Full Name/i, 'Sadia Rehman');
    type(/Father \/ Guardian Name/i, 'Rehman Ali');
    typeIn(screen.getByLabelText(/CNIC/i, { selector: '#cnic' }), '42101-3320145-6');
    type(/Date of Birth/i, '1990-02-14');
    type(/Email/i, 'sadia@example.pk');
    type(/Mobile/i, '03453320145');
    type(/Address/i, 'Block 5, Clifton');
    typeIn(screen.getByLabelText(/City/i, { selector: '#city' }), 'Karachi');
    type(/Highest Qualification/i, 'M.A. English');
    type(/Specialization/i, 'English');
    type(/Years of Teaching Experience/i, '7');
    type(/Years of Marking Experience/i, '2');

    fireEvent.click(screen.getByLabelText(/Gender/i, { selector: 'button' }));
    fireEvent.click(screen.getByRole('option', { name: 'Female' }));
    fireEvent.click(screen.getByLabelText(/Province/i, { selector: 'button' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sindh' }));

    // MultiSelectField keeps its options in a popover, and its trigger is not linked to
    // its label (no aria-labelledby), so reach the trigger through the shared wrapper.
    const openPicker = (labelText: string): void => {
      const trigger = screen
        .getByText(labelText)
        .closest('.relative')
        ?.querySelector('[role="button"]');
      fireEvent.click(trigger as Element);
    };
    openPicker('Subjects');
    fireEvent.click(await screen.findByText('Biology'));
    openPicker('Classes');
    fireEvent.click(await screen.findByText('Class 9'));

    const file = new File(['x'], 'ma-english.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Qualification certificate/i), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByText(/confidentiality undertaking/i));

    const submit = screen.getByRole('button', { name: /Submit for Approval/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const dto = onSubmit.mock.calls[0]?.[0] as CreateCheckerDto | undefined;
    expect(dto?.checkerType).toBe('school-specific');
    expect(dto?.instituteId).toBe('sch_002');
    expect(dto?.addedBy).toBe('institute');
    expect(dto?.addedByInstituteId).toBe('sch_002');
    expect(dto?.documents).toEqual([{ kind: 'qualification', fileName: 'ma-english.pdf' }]);
  });
});
