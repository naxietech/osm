/**
 * Change your own password. Formik + Yup against `POST /auth/password/change`.
 *
 * The API revokes every session on success — by design, so a stolen session cannot
 * outlive the password it was opened with. That means the only correct ending here is
 * to clear the local session and send the user back to sign in.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMutation } from '@tanstack/react-query';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import type { ChangePasswordRequest } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Lock } from '@/design-system/atoms/icon';
import { Alert } from '@/design-system/molecules/alert';
import { FormField } from '@/design-system/molecules/form-field';
import { AuthLayout } from '@/design-system/templates/auth-layout';
import { useAuth } from '@/hooks';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { authService } from '@/services/auth.service';

/** Mirrors the API's own rule so the form fails before the round trip. */
const validationSchema = Yup.object({
  currentPassword: Yup.string().required('Your current password is required'),
  newPassword: Yup.string()
    .min(MIN_PASSWORD_LENGTH, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .notOneOf([Yup.ref('currentPassword')], 'The new password must be different')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'The two passwords do not match')
    .required('Please re-type the new password'),
});

export function ChangePasswordPage(): React.ReactElement {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const changeMutation = useMutation({
    mutationFn: (dto: ChangePasswordRequest) => authService.changePassword(dto),
    onSuccess: () => {
      logout();
      void navigate(ROUTES.login, {
        replace: true,
        state: { notice: 'Password changed. Please sign in with your new password.' },
      });
    },
    // A 400 here carries the API's own "Current password is incorrect".
    onError: (err: unknown) => {
      setSubmitError(apiErrorMessage(err));
    },
  });

  const formik = useFormik({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validationSchema,
    onSubmit: (values) => {
      setSubmitError(null);
      changeMutation.mutate({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
    },
  });

  return (
    <AuthLayout
      title="Change password"
      subtitle="You will be signed out of every device afterwards."
    >
      <form onSubmit={formik.handleSubmit} noValidate className="space-y-4">
        <FormField
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          label="Current Password"
          leadingIcon={<Lock aria-hidden />}
          value={formik.values.currentPassword}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.currentPassword ? formik.errors.currentPassword : undefined}
          required
        />

        <FormField
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          label="New Password"
          leadingIcon={<Lock aria-hidden />}
          value={formik.values.newPassword}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.newPassword ? formik.errors.newPassword : undefined}
          required
        />

        <FormField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          label="Re-type New Password"
          leadingIcon={<Lock aria-hidden />}
          value={formik.values.confirmPassword}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.confirmPassword ? formik.errors.confirmPassword : undefined}
          required
        />

        {submitError && <Alert tone="danger">{submitError}</Alert>}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => void navigate(-1)}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={changeMutation.isPending} className="flex-1">
            Change Password
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

export default ChangePasswordPage;
