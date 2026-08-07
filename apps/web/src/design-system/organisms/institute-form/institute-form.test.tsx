import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { InstituteCategory } from '@oses/types';

import { InstituteForm } from './institute-form';

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
    target: { value: 'Test Institute' },
  });
  choose(/Category/i, 'School');
  choose(/Institution Type/i, 'Government');
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
    target: { value: 'test@institute.pk' },
  });
  fireEvent.change(screen.getByLabelText(/Contact Phone/i), {
    target: { value: '+92-51-1234567' },
  });
}

/**
 * Whole category records, not `{value,label}` pairs — a category carries the questions the form
 * has to ask. School asks two; College asks none, which is what makes the "only the selected
 * category's questions" assertions below mean something.
 */
const CATEGORIES: InstituteCategory[] = [
  {
    id: 'cat_school',
    code: 'SCH',
    name: 'School',
    isActive: true,
    version: 1,
    questions: [
      {
        id: 'q_board',
        text: 'Which board are you affiliated with?',
        type: 'radio',
        required: true,
        options: ['Federal', 'Punjab'],
      },
      {
        id: 'q_notes',
        text: 'Anything else we should know?',
        type: 'text',
        required: false,
        options: [],
      },
    ],
  },
  { id: 'cat_college', code: 'COL', name: 'College', isActive: true, version: 1, questions: [] },
];

/** The two create-mode-only fields, filled with a matching pair. */
function fillPasswords(value = 'a-strong-password'): void {
  fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value } });
  fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value } });
}

describe('InstituteForm', () => {
  it('renders the text fields and dropdowns', () => {
    render(<InstituteForm categories={CATEGORIES} {...defaultProps} />);
    expect(screen.getByLabelText(/Institution Code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Institution Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Branch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Institution Type/i)).toBeInTheDocument();
    // Every institute belongs to a category, and the API refuses a registration without one —
    // this form could not set it before, so the request it built was never valid.
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
    render(<InstituteForm categories={CATEGORIES} {...defaultProps} onSubmit={handleSubmit} />);

    fillValidForm();
    fillPasswords();
    fireEvent.click(screen.getByRole('radio', { name: 'Federal' }));
    fireEvent.click(screen.getByText('Create & Register Institute'));

    await waitFor(() =>
      expect(handleSubmit).toHaveBeenCalledWith({
        instituteCode: 'ISB-001',
        instituteName: 'Test Institute',
        categoryId: 'cat_school',
        institutionType: 'government',
        address: 'Street 1, Sector F-8',
        city: 'Islamabad',
        province: 'punjab',
        postalCode: '44000',
        contactPersonName: 'Test Person',
        contactPersonDesignation: 'Principal',
        contactEmail: 'test@institute.pk',
        contactPhone: '+92-51-1234567',
        password: 'a-strong-password',
        answers: [{ questionId: 'q_board', values: ['Federal'] }],
      }),
    );
  });

  it('shows a validation error and does not submit when required fields are empty', async () => {
    const handleSubmit = vi.fn();
    render(<InstituteForm categories={CATEGORIES} {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.click(screen.getByText('Create & Register Institute'));

    await waitFor(() => {
      expect(screen.getByText('Institute code is required')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('disables submit button when isSubmitting is true', () => {
    render(<InstituteForm categories={CATEGORIES} {...defaultProps} isSubmitting />);
    expect(screen.getByText('Create & Register Institute').closest('button')).toBeDisabled();
  });

  it('shows instituteCode field as disabled in edit mode', () => {
    render(<InstituteForm categories={CATEGORIES} {...defaultProps} mode="edit" />);
    expect(screen.getByLabelText(/Institution Code/i)).toBeDisabled();
  });

  it('pre-fills fields from initialValues', () => {
    render(
      <InstituteForm
        categories={CATEGORIES}
        {...defaultProps}
        initialValues={{ instituteName: 'Existing Institute', city: 'Lahore' }}
      />,
    );
    expect(screen.getByLabelText(/Institution Name/i)).toHaveValue('Existing Institute');
    expect(screen.getByLabelText(/City/i)).toHaveValue('Lahore');
  });

  describe('category questions', () => {
    /**
     * The defect: this form took `{value,label}` pairs, so it had no questions to render. An
     * admin picked "School", saw its name and nothing else, and created an institute with no
     * answers to questions the category requires.
     */
    it("asks the selected category's questions, and only those", () => {
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} />);

      // Nothing to ask before a category is chosen.
      expect(screen.queryByText(/Which board are you affiliated with/i)).not.toBeInTheDocument();

      choose(/Category/i, 'School');

      expect(screen.getByText(/Which board are you affiliated with/i)).toBeInTheDocument();
      expect(screen.getByText(/Anything else we should know/i)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Federal' })).toBeInTheDocument();
    });

    it('drops the questions when the category is changed to one with none', () => {
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} />);
      choose(/Category/i, 'School');
      expect(screen.getByText(/Which board are you affiliated with/i)).toBeInTheDocument();

      choose(/Category/i, 'College');

      expect(screen.queryByText(/Which board are you affiliated with/i)).not.toBeInTheDocument();
    });

    it('sends no answers from a category the admin changed their mind about', async () => {
      // The API refuses an answer whose question is not in the chosen category, and it is right
      // to — so the form must not carry the abandoned one along.
      const handleSubmit = vi.fn();
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} onSubmit={handleSubmit} />);

      fillValidForm();
      fillPasswords();
      fireEvent.click(screen.getByRole('radio', { name: 'Federal' }));
      choose(/Category/i, 'College');
      fireEvent.click(screen.getByText('Create & Register Institute'));

      await waitFor(() => expect(handleSubmit).toHaveBeenCalled());
      expect(handleSubmit.mock.calls[0]?.[0]).not.toHaveProperty('answers');
    });

    it('asks nothing on an edit, because the API refuses to change answers', () => {
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} mode="edit" />);
      choose(/Category/i, 'School');

      expect(screen.queryByText(/Which board are you affiliated with/i)).not.toBeInTheDocument();
    });
  });

  describe('sign-in details', () => {
    it('collects a password on create — without one nobody can sign in as the institute', () => {
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} />);

      expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    });

    it('refuses a mismatched pair', async () => {
      const handleSubmit = vi.fn();
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} onSubmit={handleSubmit} />);

      fillValidForm();
      fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password-one' } });
      fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
        target: { value: 'password-two' },
      });
      fireEvent.click(screen.getByText('Create & Register Institute'));

      await waitFor(() =>
        expect(screen.getByText(/two passwords do not match/i)).toBeInTheDocument(),
      );
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('asks for no password on an edit — that is the reset flow, not this form', () => {
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} mode="edit" />);
      expect(screen.queryByLabelText(/^Password/i)).not.toBeInTheDocument();
    });

    it('asks for no password from a caller who may only look', () => {
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} readOnly />);
      expect(screen.queryByLabelText(/^Password/i)).not.toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    it('offers delete on an edit, apart from Save', () => {
      const onDelete = vi.fn();
      render(
        <InstituteForm categories={CATEGORIES} {...defaultProps} mode="edit" onDelete={onDelete} />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Delete Institute/i }));
      expect(onDelete).toHaveBeenCalled();
    });

    it('offers no delete while creating — there is nothing to delete yet', () => {
      const onDelete = vi.fn();
      render(<InstituteForm categories={CATEGORIES} {...defaultProps} onDelete={onDelete} />);

      expect(screen.queryByRole('button', { name: /Delete Institute/i })).not.toBeInTheDocument();
    });

    it('withholds delete from a caller who may only look', () => {
      const onDelete = vi.fn();
      render(
        <InstituteForm
          categories={CATEGORIES}
          {...defaultProps}
          mode="edit"
          readOnly
          onDelete={onDelete}
        />,
      );

      expect(screen.queryByRole('button', { name: /Delete Institute/i })).not.toBeInTheDocument();
    });
  });
});
