/**
 * SubjectForm (organism) — the create/edit dialog for a subject.
 *
 * Self-contained and presentational: Formik + Yup own the draft and the validation, and
 * `onSave` receives trimmed values. The parent page owns the service calls (create vs update)
 * and the list — mirroring InstituteCategoryForm.
 *
 * The dialog is owned here rather than by the page because the footer buttons need the form's
 * own state (`isValid`, `dirty`, submit) to decide whether saving is offered. Handing that back
 * up to the page would put Formik in the page again, which is the thing this extraction removes.
 *
 * Remount it (via a React `key`) to switch edit targets — there is deliberately no
 * `enableReinitialize`, which would silently do nothing against constant initial values.
 */
import React from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { Modal } from '@/design-system/molecules/modal';

/** The value emitted on save — the parent maps this onto its create/update DTO. */
export interface SubjectFormValue {
  code: string;
  name: string;
}

export interface SubjectFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** Existing values when editing; omitted for the create flow. */
  initialValue?: SubjectFormValue;
  /** A save is in flight: the dialog locks and the confirm button spins. */
  isSaving?: boolean;
  onSave: (value: SubjectFormValue) => void;
  onCancel: () => void;
}

const EMPTY: SubjectFormValue = { code: '', name: '' };

/**
 * Mirrors the API's own limits (`subjects_code_chk` / `subjects_name_chk` and the Zod DTO), so
 * an obviously bad value fails before the round trip. The server still decides — this only
 * saves a request, it is not the guarantee.
 */
const subjectSchema = Yup.object({
  code: Yup.string()
    .trim()
    .max(20, 'At most 20 characters')
    .matches(/^[A-Za-z0-9_-]*$/, 'Letters, numbers, dashes and underscores only')
    .required('A code is required'),
  name: Yup.string().trim().max(100, 'At most 100 characters').required('A name is required'),
});

export function SubjectForm({
  open,
  mode,
  initialValue,
  isSaving = false,
  onSave,
  onCancel,
}: SubjectFormProps): React.ReactElement {
  const isEditing = mode === 'edit';

  const form = useFormik<SubjectFormValue>({
    initialValues: initialValue ?? EMPTY,
    validationSchema: subjectSchema,
    onSubmit: (values) => onSave({ code: values.code.trim(), name: values.name.trim() }),
  });

  const saveLabel = isEditing ? 'Save Changes' : 'Add Subject';

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={isEditing ? 'Edit Subject' : 'Add Subject'}
      busy={isSaving}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void form.submitForm()}
            isLoading={isSaving}
            // `dirty` as well as `isValid`: Formik reports a freshly-opened form as valid
            // because validation has not run yet, so `isValid` alone leaves the button
            // offering to save a blank Add form. On Edit it also blocks a no-op save, which
            // would otherwise spend a write bumping updated_at for no change.
            disabled={!form.isValid || !form.dirty}
          >
            {saveLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="code"
          name="code"
          label="Code"
          value={form.values.code}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.code ? form.errors.code : undefined}
          required
        />
        <FormField
          id="name"
          name="name"
          label="Name"
          value={form.values.name}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.name ? form.errors.name : undefined}
          required
        />
      </div>
    </Modal>
  );
}

export default SubjectForm;
