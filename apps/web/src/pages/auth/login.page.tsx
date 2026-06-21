/**
 * Login page — uses AuthLayout template.
 * TODO: Connect to Redux auth slice and API call in next phase.
 * Currently uses local state to simulate loading and error states.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/design-system/atoms/button';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';
import { AuthLayout } from '@/design-system/templates/auth-layout';

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    // TODO: Replace with real API call via authService.login({ email, password })
    setTimeout(() => {
      console.log('Login attempt:', { email, password });
      setIsSubmitting(false);
      void navigate('/admin');
    }, 1500);
  };

  return (
    <AuthLayout title="Sign In" subtitle="On-Screen Exam System — Pakistan">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField id="email" label="Email Address" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@oses.pk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>

        <FormField id="password" label="Password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>

        {error && (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full"
        >
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
