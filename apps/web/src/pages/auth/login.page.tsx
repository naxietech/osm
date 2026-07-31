/**
 * Login page — Formik + Yup validation against the real `POST /auth/login`. The API
 * sets HttpOnly session cookies and returns the user; useAuth holds it and we route to
 * the role home.
 */
import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useMutation } from '@tanstack/react-query';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import type { LoginRequest } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Checkbox } from '@/design-system/atoms/checkbox';
import { Lock, Mail } from '@/design-system/atoms/icon';
import { FormField } from '@/design-system/molecules/form-field';
import { AuthLayout } from '@/design-system/templates/auth-layout';
import { useAuth } from '@/hooks';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';

const validationSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Set by the change-password page, which has to send the user back here because the
  // API revokes every session once the password changes.
  const notice = (location.state as { notice?: string } | null)?.notice;

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginRequest) => login(credentials),
    onSuccess: () => {
      void navigate('/');
    },
    // The API deliberately answers a bad email and a bad password identically, so this
    // page must not add anything that would reveal which accounts exist.
    onError: (err: unknown) => {
      setSubmitError(apiErrorMessage(err));
    },
  });

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema,
    onSubmit: (values) => {
      setSubmitError(null);
      loginMutation.mutate(values);
    },
  });

  // Already signed in and came back here — browser back button, a bookmark, a stale tab.
  // This reads the cached session only; the provider still skips `GET /auth/me` on public
  // routes, so a genuinely signed-out visitor costs no request to land here.
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your dashboard.">
      <form onSubmit={formik.handleSubmit} noValidate className="space-y-4">
        {notice && !submitError && (
          <div role="status" className="rounded-md bg-brand-subtle px-4 py-3 text-sm text-brand">
            {notice}
          </div>
        )}

        <FormField
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          label="Email Address"
          leadingIcon={<Mail aria-hidden />}
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.email ? formik.errors.email : undefined}
          required
        />

        <FormField
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          label="Password"
          leadingIcon={<Lock aria-hidden />}
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.password ? formik.errors.password : undefined}
          required
        />

        {/* Remember me / forgot password — visual only for now (not yet wired). */}
        <div className="flex items-center justify-between text-sm">
          <Checkbox labelClassName="text-muted-foreground" label="Remember me" />
          <button
            type="button"
            className="font-medium text-brand hover:underline"
            onClick={() => {
              /* TODO: wire password reset flow */
            }}
          >
            Forgot password?
          </button>
        </div>

        {submitError && (
          <div
            role="alert"
            className="rounded-md bg-danger-subtle px-4 py-3 text-sm text-danger-foreground"
          >
            {submitError}
          </div>
        )}

        <Button type="submit" isLoading={loginMutation.isPending} className="w-full">
          Sign In
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Registering an institute?{' '}
          <Link to={ROUTES.registerInstitute} className="font-medium text-brand hover:underline">
            Register here
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
