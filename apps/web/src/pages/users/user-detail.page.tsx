/**
 * Add User (super admin) — the only place logins are created.
 *
 * Pick a role from the server's catalogue; if it is institute-scoped (any own-institute
 * grant, or a role owned by one institute) an institute must be chosen too.
 *
 * The password field is a real requirement, not a placeholder: there is no invite email
 * yet, so whoever creates the account sets a temporary password and passes it on. The new
 * user changes it themselves from the account menu.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import type { Role } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField } from '@/design-system/molecules/select-field';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { INSTITUTE_OPTIONS } from '@/services/institute.service';
import { rolesService } from '@/services/roles.service';
import { usersService } from '@/services/users.service';

/** A role is institute-scoped if it belongs to one institute or holds an own-institute grant. */
function isInstituteScoped(role: Role | undefined): boolean {
  return Boolean(role?.instituteId || role?.grants.some((g) => g.scope === 'own-institute'));
}

/**
 * Mirrors the API's own rules so the form fails before the round trip. Built from the
 * fetched roles because whether an institute is required depends on the role picked — a
 * static schema couldn't know that.
 */
function buildValidationSchema(roles: Role[]): Yup.ObjectSchema<Record<string, unknown>> {
  return Yup.object({
    fullName: Yup.string().trim().required('Full name is required').max(100),
    email: Yup.string().email('Enter a valid email address').required('Email is required'),
    roleId: Yup.string().required('A role is required'),
    password: Yup.string()
      .min(8, 'Temporary password must be at least 8 characters')
      .required('A temporary password is required'),
    instituteId: Yup.string().test(
      'institute-required-for-scoped-role',
      'This role is limited to one institute, so pick one',
      function instituteRequired(value) {
        const role = roles.find((r) => r.id === (this.parent as { roleId?: string }).roleId);
        return !isInstituteScoped(role) || Boolean(value);
      },
    ),
  });
}

export function UserDetailPage(): React.ReactElement {
  const navigate = useNavigate();
  const backToList = (): void => void navigate(ROUTES.admin.users);

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => rolesService.listRoles() });
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const validationSchema = useMemo(() => buildValidationSchema(roles), [roles]);

  const createMutation = useMutation({
    mutationFn: usersService.createUser,
    onSuccess: backToList,
  });

  const formik = useFormik({
    initialValues: { fullName: '', email: '', roleId: '', password: '', instituteId: '' },
    validationSchema,
    onSubmit: (values) => {
      createMutation.mutate({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        roleId: values.roleId,
        password: values.password,
        ...(values.instituteId ? { instituteId: values.instituteId } : {}),
      });
    },
  });

  const needsInstitute = isInstituteScoped(roles.find((r) => r.id === formik.values.roleId));

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <PageHeader
        title="Add User"
        subtitle="Create a login and assign a role"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={backToList}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Create User
            </Button>
          </div>
        }
      />

      <div className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <FormField
          id="fullName"
          name="fullName"
          label="Full Name"
          value={formik.values.fullName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.fullName ? formik.errors.fullName : undefined}
          required
        />

        <FormField
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          label="Email Address"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.email ? formik.errors.email : undefined}
          required
        />

        <SelectField
          label="Role"
          value={formik.values.roleId}
          onChange={(v) => void formik.setFieldValue('roleId', v)}
          options={roleOptions}
          error={formik.touched.roleId ? formik.errors.roleId : undefined}
          required
        />

        {needsInstitute && (
          <SelectField
            label="Institute"
            value={formik.values.instituteId}
            onChange={(v) => void formik.setFieldValue('instituteId', v)}
            options={INSTITUTE_OPTIONS}
            error={formik.touched.instituteId ? formik.errors.instituteId : undefined}
            required
          />
        )}

        <FormField
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          label="Temporary Password"
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.password ? formik.errors.password : undefined}
          required
        />

        <p className="text-xs text-muted-foreground">
          Share this password with the user directly — there is no invitation email yet. They can
          change it from the account menu after signing in.
        </p>

        {createMutation.isError && (
          <div
            role="alert"
            className="rounded-md bg-danger-subtle px-4 py-3 text-sm text-danger-foreground"
          >
            {apiErrorMessage(createMutation.error)}
          </div>
        )}
      </div>
    </form>
  );
}

export default UserDetailPage;
