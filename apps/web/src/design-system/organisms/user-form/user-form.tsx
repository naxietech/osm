import React, { useMemo } from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import type { Role } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Alert } from '@/design-system/molecules/alert';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField } from '@/design-system/molecules/select-field';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { instituteRequirementFor, showsInstitutePicker } from '@/lib/role-institute-scope';

export interface UserFormValues {
  fullName: string;
  email: string;
  roleId: string;
  /** Create only. In edit mode the field is not rendered and this stays empty. */
  password: string;
  instituteId?: string;
}

/** The account being edited, as the form needs it. */
export type UserFormInitialValues = Omit<UserFormValues, 'password'>;

export interface UserFormProps {
  /** Assignable roles, from `GET /roles`. */
  roles: Role[];
  /** Institutes offered when the chosen role takes one. */
  instituteOptions: Array<{ value: string; label: string }>;
  /**
   * Present = editing that account, absent = creating one. Edit mode drops the temporary
   * password field, because changing a password is its own endpoint with its own side
   * effects (it signs the user out everywhere), and folding it into a name change would
   * make an innocuous edit do something the admin never asked for.
   */
  initialValues?: UserFormInitialValues;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Server-side failure to show above the actions, already turned into a sentence. */
  submitError?: string | null;
}

/**
 * Create-a-user form. Owns its validation and the institute rule; the page supplies the
 * data and handles the API call.
 *
 * The institute rule has three states rather than a yes/no (see `role-institute-scope`):
 * required for institute-scoped roles, optional for Evaluator (school-specific vs general
 * checker), and hidden for global roles.
 */
function buildValidationSchema(roles: Role[], isEdit: boolean): Yup.ObjectSchema<UserFormValues> {
  return Yup.object({
    fullName: Yup.string().trim().required('Full name is required').max(100),
    email: Yup.string().email('Enter a valid email address').required('Email is required'),
    roleId: Yup.string().required('A role is required'),
    password: isEdit
      ? Yup.string()
      : Yup.string()
          .min(
            MIN_PASSWORD_LENGTH,
            `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          )
          .required('A temporary password is required'),
    instituteId: Yup.string().test(
      'institute-required-for-scoped-role',
      'This role is limited to one institute, so pick one',
      function instituteRequired(value) {
        const roleId = (this.parent as { roleId?: string }).roleId;
        const requirement = instituteRequirementFor(roles.find((r) => r.id === roleId));
        return requirement !== 'required' || Boolean(value);
      },
    ),
  }) as Yup.ObjectSchema<UserFormValues>;
}

export function UserForm({
  roles,
  instituteOptions,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError,
}: UserFormProps): React.ReactElement {
  const isEdit = initialValues !== undefined;
  const validationSchema = useMemo(() => buildValidationSchema(roles, isEdit), [roles, isEdit]);

  const formik = useFormik<UserFormValues>({
    initialValues: {
      fullName: initialValues?.fullName ?? '',
      email: initialValues?.email ?? '',
      roleId: initialValues?.roleId ?? '',
      password: '',
      instituteId: initialValues?.instituteId ?? '',
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: (values) =>
      onSubmit({
        ...values,
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        // Only send an institute the role actually takes. Without this a value left over
        // from a previously-selected role would bind, say, a Super Admin to one institute
        // — which the API stores happily and which then locks them out of every other one.
        //
        // Edit keeps the empty string rather than dropping the key: the page diffs these
        // values against the saved account, and a missing key would read as "unchanged"
        // exactly when the admin has just cleared the institute.
        ...(isEdit || values.instituteId ? { instituteId: values.instituteId ?? '' } : {}),
      }),
  });

  const selectedRole = roles.find((r) => r.id === formik.values.roleId);
  const requirement = instituteRequirementFor(selectedRole);
  const showsInstitute = showsInstitutePicker(selectedRole);

  /**
   * Changing role re-scopes the institute, so a stale value must not survive the switch.
   * Dropdowns never fire blur, so choosing a value is the only "I've engaged with this"
   * signal they give — mark them touched here or their errors never appear.
   */
  const handleRoleChange = (nextRoleId: string): void => {
    void formik.setFieldTouched('roleId', true);
    void formik.setFieldValue('roleId', nextRoleId);

    const next = roles.find((r) => r.id === nextRoleId);
    if (!showsInstitutePicker(next)) void formik.setFieldValue('instituteId', '');
  };

  const handleInstituteChange = (nextInstituteId: string): void => {
    void formik.setFieldTouched('instituteId', true);
    void formik.setFieldValue('instituteId', nextInstituteId);
  };

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const roleChanged = isEdit && formik.values.roleId !== initialValues.roleId;

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="space-y-4">
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
        onChange={handleRoleChange}
        options={roleOptions}
        error={formik.touched.roleId ? formik.errors.roleId : undefined}
        required
      />

      {showsInstitute && (
        <>
          <SelectField
            label={requirement === 'optional' ? 'Institute (optional)' : 'Institute'}
            value={formik.values.instituteId ?? ''}
            onChange={handleInstituteChange}
            // An optional institute needs a way back out, or an evaluator who was made
            // school-specific could never be returned to marking across all institutes.
            options={
              requirement === 'optional'
                ? [{ value: '', label: 'No institute (general evaluator)' }, ...instituteOptions]
                : instituteOptions
            }
            error={formik.touched.instituteId ? formik.errors.instituteId : undefined}
            required={requirement === 'required'}
          />
          {requirement === 'optional' && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Pick an institute to limit this evaluator to that institute&rsquo;s papers. Leave it
              blank and they can mark across all institutes.
            </p>
          )}
        </>
      )}

      {!isEdit && (
        <>
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
        </>
      )}

      {roleChanged && (
        <Alert tone="warning">
          Changing the role signs this user out of every device straight away. They will need to log
          in again, and the new permissions apply from their next request.
        </Alert>
      )}

      {submitError && <Alert tone="danger">{submitError}</Alert>}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isEdit && !formik.dirty}
          className="w-full sm:w-auto"
        >
          {isEdit ? 'Save Changes' : 'Create User'}
        </Button>
      </div>
    </form>
  );
}

export default UserForm;
