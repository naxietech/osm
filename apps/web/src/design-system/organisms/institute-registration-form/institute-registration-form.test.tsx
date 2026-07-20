import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstituteRegistrationForm } from './institute-registration-form';

const baseProps = {
  categories: [],
  isCodeTaken: () => false,
  onSubmit: vi.fn(),
};

// Formik validates asynchronously, so validity-driven assertions are awaited.
describe('InstituteRegistrationForm', () => {
  it('renders the new Level and Gender selects and disables submit until valid', async () => {
    render(<InstituteRegistrationForm {...baseProps} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Education Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gender/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Submit Registration/i })).toBeDisabled(),
    );
  });

  it('flags a duplicate institute code', async () => {
    render(
      <InstituteRegistrationForm
        {...baseProps}
        onSubmit={vi.fn()}
        isCodeTaken={(c) => c.trim().toUpperCase() === 'DUP-1'}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Institute Code/i), { target: { value: 'DUP-1' } });
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });

  it('flags an invalid email', async () => {
    render(<InstituteRegistrationForm {...baseProps} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Contact Email/i), {
      target: { value: 'not-an-email' },
    });
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });
});
