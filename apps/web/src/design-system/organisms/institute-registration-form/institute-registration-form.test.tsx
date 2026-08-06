import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstituteRegistrationForm } from './institute-registration-form';

const baseProps = {
  categories: [],
  onSubmit: vi.fn(),
};

// Formik validates asynchronously, so validity-driven assertions are awaited.
describe('InstituteRegistrationForm', () => {
  it('asks for a password and keeps submit disabled until the form is valid', async () => {
    // The password is collected here because there is no email service to send a temporary one
    // with — it becomes the institute's login the moment a super admin approves.
    render(<InstituteRegistrationForm {...baseProps} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Submit Registration/i })).toBeDisabled(),
    );
  });

  it('pre-fills the code and email the page already checked', () => {
    // Availability is the server's answer, asked once before this form is shown. The form no
    // longer keeps its own duplicate predicate, which would only be a staler copy of that rule.
    render(
      <InstituteRegistrationForm
        {...baseProps}
        onSubmit={vi.fn()}
        initialCode="S01"
        initialEmail="principal@example.pk"
      />,
    );
    expect(screen.getByLabelText(/Institute Code/i)).toHaveValue('S01');
    expect(screen.getByLabelText(/Contact Email/i)).toHaveValue('principal@example.pk');
  });

  it('flags an invalid email', async () => {
    render(<InstituteRegistrationForm {...baseProps} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Contact Email/i), {
      target: { value: 'not-an-email' },
    });
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });
});
