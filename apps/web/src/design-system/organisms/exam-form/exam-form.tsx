/**
 * ExamForm (organism) — create / edit an exam (Controller Examiner).
 *
 * Per the TRD an exam is: Name/Code, Class → Group → Subgroup, one or more Subjects,
 * a Shift, a registration window and an exam-completed (result) date, targeting all or
 * selected institutes. There is no manual paper editor — one paper is derived per chosen
 * subject on submit (so the registration/candidate engine keeps working).
 */
import React from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import type { CreateExamDto, ExamInstituteScope, ExamShift } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import {
  Building2,
  Calendar,
  FileText,
  GraduationCap,
  type LucideIcon,
} from '@/design-system/atoms/icon';
import { Radio } from '@/design-system/atoms/radio';
import { FormField } from '@/design-system/molecules/form-field';
import { MultiSelectField } from '@/design-system/molecules/multi-select-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

export interface ExamFormProps {
  initialValues?: Partial<CreateExamDto>;
  /** Classes (levels) to choose from. */
  levelOptions: SelectOption[];
  /** Valid group options keyed by class id. */
  groupOptionsByLevel: Record<string, SelectOption[]>;
  /** Subgroup options keyed by `${levelId}:${groupId}`. */
  subgroupOptionsByLevelGroup: Record<string, SelectOption[]>;
  /** Subjects selectable for the exam (value = subject id, label = name). */
  subjectOptions: SelectOption[];
  /** Institutes selectable when targeting specific institutes. */
  instituteOptions: SelectOption[];
  /** Lock the scope controls (e.g. once registration has opened). */
  lockInstituteScope?: boolean;
  onSubmit: (data: CreateExamDto) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

interface ExamFormValues {
  code: string;
  name: string;
  session: string;
  levelId: string;
  groupId: string;
  subgroupId: string;
  shift: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  examCompletedDate: string;
  /** Dynamic fields — held here (not in useState) so Yup gates the submit button too. */
  subjectIds: string[];
  instituteScope: ExamInstituteScope;
  instituteIds: string[];
}

const SHIFT_OPTIONS: SelectOption[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

const validationSchema = Yup.object({
  code: Yup.string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(40, 'Code is too long')
    .required('Exam code is required'),
  name: Yup.string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .max(150, 'Name is too long')
    .required('Exam name is required'),
  session: Yup.string()
    .trim()
    .min(3, 'Session is too short')
    .max(50, 'Session is too long')
    .required('Session is required'),
  levelId: Yup.string().required('Select a class'),
  groupId: Yup.string().required('Select a group'),
  shift: Yup.string()
    .oneOf(['morning', 'afternoon', 'evening'], 'Select a shift')
    .required('Select a shift'),
  registrationOpensAt: Yup.string().required('Registration open date is required'),
  registrationClosesAt: Yup.string()
    .required('Registration close date is required')
    .test('after-open', 'Close date must be on or after the open date', function (value) {
      const { registrationOpensAt } = this.parent as ExamFormValues;
      if (!value || !registrationOpensAt) return true;
      return value >= registrationOpensAt;
    }),
  examCompletedDate: Yup.string().required('Exam completed date is required'),
  subjectIds: Yup.array().of(Yup.string().defined()).min(1, 'Select at least one subject.'),
  instituteScope: Yup.string().oneOf(['all', 'selected']).required(),
  // Only meaningful when the exam targets a chosen set of institutes.
  instituteIds: Yup.array()
    .of(Yup.string().defined())
    .when('instituteScope', {
      is: 'selected',
      then: (schema) => schema.min(1, 'Select at least one institute, or choose All institutes.'),
    }),
});

/** Iconed section heading (matches InstituteForm). */
function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{children}</h3>
    </div>
  );
}

export function ExamForm({
  initialValues,
  levelOptions,
  groupOptionsByLevel,
  subgroupOptionsByLevelGroup,
  subjectOptions,
  instituteOptions,
  lockInstituteScope = false,
  onSubmit,
  onCancel,
  isSubmitting,
  mode,
}: ExamFormProps): React.ReactElement {
  const formik = useFormik<ExamFormValues>({
    enableReinitialize: true,
    initialValues: {
      code: initialValues?.code ?? '',
      name: initialValues?.name ?? '',
      session: initialValues?.session ?? '',
      levelId: initialValues?.levelId ?? '',
      groupId: initialValues?.groupId ?? '',
      subgroupId: initialValues?.subgroupId ?? '',
      shift: initialValues?.shift ?? 'morning',
      registrationOpensAt: initialValues?.registrationOpensAt ?? '',
      registrationClosesAt: initialValues?.registrationClosesAt ?? '',
      examCompletedDate: initialValues?.examCompletedDate ?? '',
      subjectIds: initialValues?.subjectIds ?? [],
      instituteScope: initialValues?.instituteScope ?? 'all',
      instituteIds: initialValues?.instituteIds ?? [],
    },
    validationSchema,
    onSubmit: (values) => {
      // One paper per chosen subject (compulsory) — sat on the exam-completed date.
      const paperDate = values.examCompletedDate || values.registrationClosesAt;
      const papers = values.subjectIds.map((sid) => ({
        subject: subjectOptions.find((o) => o.value === sid)?.label ?? sid,
        totalMarks: 100,
        paperDate,
        paperType: 'compulsory' as const,
      }));

      const dto: CreateExamDto = {
        code: values.code.trim(),
        name: values.name.trim(),
        session: values.session.trim(),
        levelId: values.levelId,
        groupId: values.groupId,
        subjectIds: values.subjectIds,
        shift: values.shift as ExamShift,
        instituteScope: values.instituteScope,
        registrationOpensAt: values.registrationOpensAt,
        registrationClosesAt: values.registrationClosesAt,
        examCompletedDate: values.examCompletedDate,
        papers,
        ...(values.subgroupId ? { subgroupId: values.subgroupId } : {}),
        ...(values.instituteScope === 'selected' ? { instituteIds: values.instituteIds } : {}),
      };
      onSubmit(dto);
    },
  });

  const fieldError = (name: keyof ExamFormValues): string | undefined =>
    formik.touched[name] ? (formik.errors[name] as string | undefined) : undefined;

  /**
   * The multi-selects have no blur to mark them touched, so their message shows as soon
   * as the schema objects — matching how the rest of the form reads while being filled.
   */
  const listError = (name: 'subjectIds' | 'instituteIds'): string | undefined =>
    formik.errors[name] as string | undefined;

  const setField = (name: keyof ExamFormValues, value: unknown): void =>
    void formik.setFieldValue(name, value, true);

  const gridClass = 'grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 lg:grid-cols-3';
  const subgroupOpts =
    subgroupOptionsByLevelGroup[`${formik.values.levelId}:${formik.values.groupId}`] ?? [];

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="space-y-10">
      <section>
        <SectionHeading icon={GraduationCap}>Exam Details</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="name"
            name="name"
            label="Exam Name (e.g. SSC-9th-science-bio)"
            containerClassName="md:col-span-2 lg:col-span-3"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('name')}
            required
          />
          <FormField
            id="code"
            name="code"
            label="Exam Code"
            value={formik.values.code}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('code')}
            disabled={mode === 'edit'}
            required
          />
          <FormField
            id="session"
            name="session"
            label="Session (e.g. Annual 2026)"
            value={formik.values.session}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('session')}
            required
          />
          <SelectField
            id="shift"
            name="shift"
            label="Shift"
            options={SHIFT_OPTIONS}
            required
            value={formik.values.shift}
            onChange={(value) => void formik.setFieldValue('shift', value)}
            onBlur={() => void formik.setFieldTouched('shift', true)}
            error={fieldError('shift')}
          />
          <SelectField
            id="levelId"
            name="levelId"
            label="Class"
            options={levelOptions}
            required
            value={formik.values.levelId}
            onChange={(value) => {
              void formik.setFieldValue('levelId', value);
              void formik.setFieldValue('groupId', '');
              void formik.setFieldValue('subgroupId', '');
            }}
            onBlur={() => void formik.setFieldTouched('levelId', true)}
            error={fieldError('levelId')}
          />
          <SelectField
            id="groupId"
            name="groupId"
            label="Group"
            options={groupOptionsByLevel[formik.values.levelId] ?? []}
            disabled={!formik.values.levelId}
            required
            value={formik.values.groupId}
            onChange={(value) => {
              void formik.setFieldValue('groupId', value);
              void formik.setFieldValue('subgroupId', '');
            }}
            onBlur={() => void formik.setFieldTouched('groupId', true)}
            error={fieldError('groupId')}
          />
          {subgroupOpts.length > 0 && (
            <SelectField
              id="subgroupId"
              name="subgroupId"
              label="Subgroup"
              options={subgroupOpts}
              disabled={!formik.values.groupId}
              value={formik.values.subgroupId}
              onChange={(value) => void formik.setFieldValue('subgroupId', value)}
              onBlur={() => void formik.setFieldTouched('subgroupId', true)}
            />
          )}
        </div>
      </section>

      <section>
        <SectionHeading icon={FileText}>Subjects</SectionHeading>
        <p className="mb-3 text-xs text-muted-foreground">
          Choose the subjects this exam covers — one paper is created per subject.
        </p>
        <MultiSelectField
          label="Subjects"
          options={subjectOptions}
          value={formik.values.subjectIds}
          onChange={(next) => setField('subjectIds', next)}
          searchPlaceholder="Search subjects…"
          emptyMessage="No subjects match"
          error={listError('subjectIds')}
        />
      </section>

      <section>
        <SectionHeading icon={Calendar}>Registration &amp; Result</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="registrationOpensAt"
            name="registrationOpensAt"
            label="Registration Opens"
            type="date"
            value={formik.values.registrationOpensAt}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('registrationOpensAt')}
            required
          />
          <FormField
            id="registrationClosesAt"
            name="registrationClosesAt"
            label="Registration Closes"
            type="date"
            value={formik.values.registrationClosesAt}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('registrationClosesAt')}
            required
          />
          <FormField
            id="examCompletedDate"
            name="examCompletedDate"
            label="Exam Completed (result day)"
            type="date"
            value={formik.values.examCompletedDate}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('examCompletedDate')}
            required
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={Building2}>Institute Scope</SectionHeading>
        <p className="mb-3 text-xs text-muted-foreground">
          Choose which institutes can register candidates into this exam.
        </p>
        <div className="space-y-3">
          <Radio
            name="instituteScope"
            label="All institutes"
            checked={formik.values.instituteScope === 'all'}
            disabled={lockInstituteScope}
            onChange={() => setField('instituteScope', 'all')}
          />
          <Radio
            name="instituteScope"
            label="Selected institutes"
            checked={formik.values.instituteScope === 'selected'}
            disabled={lockInstituteScope}
            onChange={() => setField('instituteScope', 'selected')}
          />

          {formik.values.instituteScope === 'selected' && (
            <div className="mt-1">
              <MultiSelectField
                label="Institutes"
                options={instituteOptions}
                value={formik.values.instituteIds}
                onChange={(next) => setField('instituteIds', next)}
                searchPlaceholder="Search institutes…"
                emptyMessage="No institutes match"
                error={listError('instituteIds')}
                disabled={lockInstituteScope}
              />
            </div>
          )}
        </div>
      </section>

      <div className="flex gap-3 border-t border-border pt-6">
        <Button type="submit" size="lg" isLoading={isSubmitting}>
          {mode === 'create' ? 'Create Exam' : 'Save Changes'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default ExamForm;
