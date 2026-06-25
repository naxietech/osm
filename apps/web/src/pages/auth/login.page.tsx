/**
 * Login page — Formik + Yup validation, submitted via a React Query mutation
 * against the mock authService. On success it stores the user + token (useAuth)
 * and routes to the role home.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMutation } from '@tanstack/react-query';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import { Button } from '@/design-system/atoms/button';
import { Lock, Mail } from '@/design-system/atoms/icon';
import { FormField } from '@/design-system/molecules/form-field';
import { AuthLayout } from '@/design-system/templates/auth-layout';
import { useAuth } from '@/hooks';
import { DEMO_PASSWORD, MOCK_USERS, authService } from '@/services/auth.service';

const validationSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      authService.login(vars.email, vars.password),
    onSuccess: ({ user, token }) => {
      login(user, token);
      void navigate('/');
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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

  return (
    <AuthLayout title="Sign In" subtitle="On-Screen Exam System — Pakistan">
      <form onSubmit={formik.handleSubmit} noValidate className="space-y-4">
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
      </form>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        Demo accounts — password{' '}
        <span className="font-medium text-foreground">{DEMO_PASSWORD}</span>
        <br />
        {MOCK_USERS.map((u) => u.email).join(' · ')}
      </p>
    </AuthLayout>
  );
}

export default LoginPage;
