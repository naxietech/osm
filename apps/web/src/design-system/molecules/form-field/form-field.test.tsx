import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/design-system/atoms/input';

import { FormField } from './form-field';

describe('FormField', () => {
  it('renders label text', () => {
    render(
      <FormField id="school-name" label="School Name">
        <Input id="school-name" />
      </FormField>,
    );
    expect(screen.getByText('School Name')).toBeInTheDocument();
  });

  it('renders children (Input) inside it', () => {
    render(
      <FormField id="email" label="Email">
        <Input id="email" placeholder="Enter email" />
      </FormField>,
    );
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('shows error message when error prop provided', () => {
    render(
      <FormField id="email" label="Email" error="Email is required">
        <Input id="email" />
      </FormField>,
    );
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('does not render error element when no error', () => {
    render(
      <FormField id="email" label="Email">
        <Input id="email" />
      </FormField>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows required asterisk when required is true', () => {
    render(
      <FormField id="email" label="Email" required>
        <Input id="email" />
      </FormField>,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
