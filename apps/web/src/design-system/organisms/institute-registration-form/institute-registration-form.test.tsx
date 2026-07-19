import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InstituteRegistrationForm } from './institute-registration-form';

const baseProps = {
  categories: [],
  isCodeTaken: () => false,
  onSubmit: vi.fn(),
};

describe('InstituteRegistrationForm', () => {
  it('renders the new Level and Gender selects and disables submit until valid', () => {
    render(<InstituteRegistrationForm {...baseProps} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Education Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gender/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Registration/i })).toBeDisabled();
  });

  it('flags a duplicate institute code', () => {
    render(
      <InstituteRegistrationForm
        {...baseProps}
        onSubmit={vi.fn()}
        isCodeTaken={(c) => c.trim().toUpperCase() === 'DUP-1'}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Institute Code/i), { target: { value: 'DUP-1' } });
    expect(screen.getByText(/already registered/i)).toBeInTheDocument();
  });

  it('flags an invalid email', () => {
    render(<InstituteRegistrationForm {...baseProps} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Contact Email/i), {
      target: { value: 'not-an-email' },
    });
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });
});
