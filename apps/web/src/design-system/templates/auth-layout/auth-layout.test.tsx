import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthLayout } from './auth-layout';

describe('AuthLayout', () => {
  it('renders title', () => {
    render(<AuthLayout title="Sign In"><div>form</div></AuthLayout>);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<AuthLayout title="Sign In"><div>login form here</div></AuthLayout>);
    expect(screen.getByText('login form here')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <AuthLayout title="Sign In" subtitle="Enter your credentials">
        <div>form</div>
      </AuthLayout>,
    );
    expect(screen.getByText('Enter your credentials')).toBeInTheDocument();
  });

  it('does not render subtitle element when subtitle is omitted', () => {
    render(<AuthLayout title="Sign In"><div>form</div></AuthLayout>);
    expect(screen.queryByText('Enter your credentials')).not.toBeInTheDocument();
  });
});
