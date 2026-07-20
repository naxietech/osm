/**
 * SloForm (organism) — the create/edit form for a Student Learning Outcome. An SLO is
 * class + subject specific, so both are chosen here (and locked while editing). The Code
 * must be unique within that class + subject; a Suggest button proposes the next code.
 *
 * Presentational and self-contained: Formik + Yup own the draft and validation (see
 * institute-form for the reference pattern), and `onSave` receives the trimmed value.
 * The parent page owns the service calls and injects the `isCodeTaken` / `suggestCode`
 * helpers — uniqueness is a Yup `.test()` so it reports through the same error channel
 * as every other rule.
 */
import React, { useMemo } from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

export interface SloFormValue {
  classId: string;
  subjectId: string;
  code: string;
  name: string;
  description: string;
}

export interface SloFormProps {
  /** Existing values when editing (class + subject are then locked); omitted to create. */
  initialValue?: SloFormValue;
  mode: 'create' | 'edit';
  classOptions: SelectOption[];
  subjectOptions: SelectOption[];
  /** Flags a duplicate code within the chosen class + subject (excludes the edited row). */
  isCodeTaken: (classId: string, subjectId: string, code: string) => boolean;
  /** Proposes the next code for a class + subject. */
  suggestCode: (classId: string, subjectId: string) => string;
  onSave: (value: SloFormValue) => void;
  onCancel: () => void;
}

const EMPTY: SloFormValue = { classId: '', subjectId: '', code: '', name: '', description: '' };

export function SloForm({
  initialValue,
  mode,
  classOptions,
  subjectOptions,
  isCodeTaken,
  suggestCode,
  onSave,
  onCancel,
}: SloFormProps): React.ReactElement {
  const locked = mode === 'edit';

  const validationSchema = useMemo(
    () =>
      Yup.object({
        classId: Yup.string().required('Class is required'),
        subjectId: Yup.string().required('Subject is required'),
        code: Yup.string()
          .trim()
          .required('Code is required')
          .test(
            'unique-code',
            'This code already exists for this class + subject.',
            (value, ctx) => {
              const { classId, subjectId } = ctx.parent as Pick<
                SloFormValue,
                'classId' | 'subjectId'
              >;
              if (!value || classId === '' || subjectId === '') return true;
              return !isCodeTaken(classId, subjectId, value.trim());
            },
          ),
        name: Yup.string().trim().required('Name is required'),
        description: Yup.string(),
      }),
    [isCodeTaken],
  );

  const formik = useFormik<SloFormValue>({
    initialValues: initialValue ?? EMPTY,
    validationSchema,
    // The save button reflects validity from the first render, before any field is touched.
    validateOnMount: true,
    onSubmit: (values) =>
      onSave({
        classId: values.classId,
        subjectId: values.subjectId,
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description.trim(),
      }),
  });

  /**
   * Show a field's error once the user has either left it or typed into it — a duplicate
   * code must surface as it is typed, not only after blur.
   */
  const errorFor = (key: keyof SloFormValue): string | undefined =>
    formik.touched[key] || formik.values[key].length > 0 ? formik.errors[key] : undefined;

  const suggest = (): void => {
    if (formik.values.classId === '' || formik.values.subjectId === '') return;
    void formik.setFieldValue(
      'code',
      suggestCode(formik.values.classId, formik.values.subjectId),
      true,
    );
  };

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Class"
          options={classOptions}
          value={formik.values.classId}
          onChange={(v) => void formik.setFieldValue('classId', v, true)}
          disabled={locked}
          required
        />
        <SelectField
          label="Subject"
          options={subjectOptions}
          value={formik.values.subjectId}
          onChange={(v) => void formik.setFieldValue('subjectId', v, true)}
          disabled={locked}
          required
        />

        <div>
          <FormField
            id="slo-code"
            name="code"
            label="Code"
            value={formik.values.code}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={errorFor('code')}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mt-1"
            disabled={formik.values.classId === '' || formik.values.subjectId === ''}
            onClick={suggest}
          >
            Suggest code
          </Button>
        </div>

        <FormField
          id="slo-name"
          name="name"
          label="Name / short title"
          value={formik.values.name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.name ? formik.errors.name : undefined}
          required
        />
        <FormField
          id="slo-description"
          name="description"
          label="Description (outcome statement)"
          value={formik.values.description}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          required={false}
          containerClassName="sm:col-span-2"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!formik.isValid}>
          {mode === 'edit' ? 'Save Changes' : 'Add SLO'}
        </Button>
      </div>
    </form>
  );
}

export default SloForm;
