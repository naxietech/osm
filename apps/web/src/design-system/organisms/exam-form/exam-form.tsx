/**
 * ExamForm (organism) — create / edit an exam (session) and its papers.
 *
 * Follows the SchoolForm reference: Formik + Yup for the scalar fields, FormField /
 * SelectField controls, iconed sections, submits a typed CreateExamDto. The variable
 * length paper list is handled by the PapersEditor (own React state) and validated
 * on submit. School level is derived from the grade, so it isn't asked for.
 */
import React, { useState } from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import { type CreateExamDto, type CreateExamPaperDto, SchoolLevel } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Calendar, FileText, GraduationCap, type LucideIcon } from '@/design-system/atoms/icon';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';
import { type PaperDraft, PapersEditor, emptyPaper } from '@/design-system/organisms/papers-editor';

export interface ExamFormProps {
  initialValues?: Partial<CreateExamDto>;
  onSubmit: (data: CreateExamDto) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

interface ExamFormValues {
  code: string;
  name: string;
  session: string;
  gradeId: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
}

const GRADE_OPTIONS: SelectOption[] = [
  { value: '9', label: 'Grade 9' },
  { value: '10', label: 'Grade 10' },
  { value: '11', label: 'Grade 11' },
  { value: '12', label: 'Grade 12' },
];

/** Secondary covers grades 9–10; higher secondary covers 11–12. */
function levelForGrade(gradeId: number): SchoolLevel {
  return gradeId <= 10 ? SchoolLevel.SECONDARY : SchoolLevel.HIGHER_SECONDARY;
}

const validationSchema = Yup.object({
  code: Yup.string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(30, 'Code is too long')
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
  gradeId: Yup.string()
    .oneOf(['9', '10', '11', '12'], 'Select a grade')
    .required('Grade is required'),
  registrationOpensAt: Yup.string().required('Registration open date is required'),
  registrationClosesAt: Yup.string()
    .required('Registration close date is required')
    .test('after-open', 'Close date must be on or after the open date', function (value) {
      const { registrationOpensAt } = this.parent as ExamFormValues;
      if (!value || !registrationOpensAt) return true;
      return value >= registrationOpensAt;
    }),
});

function toDraft(paper: CreateExamPaperDto): PaperDraft {
  return {
    subject: paper.subject,
    totalMarks: String(paper.totalMarks),
    paperDate: paper.paperDate,
    paperType: paper.paperType,
  };
}

/** Validate the paper rows; returns an error string or null when all rows are valid. */
function validatePapers(papers: PaperDraft[]): string | null {
  if (papers.length === 0) return 'Add at least one paper.';
  for (const [i, p] of papers.entries()) {
    const at = `Paper ${i + 1}:`;
    if (!p.subject.trim()) return `${at} subject is required.`;
    const marks = Number(p.totalMarks);
    if (!p.totalMarks.trim() || Number.isNaN(marks) || marks <= 0)
      return `${at} enter total marks greater than 0.`;
    if (!p.paperDate) return `${at} paper date is required.`;
  }
  return null;
}

/** Iconed section heading (matches SchoolForm). */
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
  onSubmit,
  onCancel,
  isSubmitting,
  mode,
}: ExamFormProps): React.ReactElement {
  const [papers, setPapers] = useState<PaperDraft[]>(
    initialValues?.papers && initialValues.papers.length > 0
      ? initialValues.papers.map(toDraft)
      : [emptyPaper()],
  );
  const [papersError, setPapersError] = useState<string | undefined>(undefined);

  const formik = useFormik<ExamFormValues>({
    enableReinitialize: true,
    initialValues: {
      code: initialValues?.code ?? '',
      name: initialValues?.name ?? '',
      session: initialValues?.session ?? '',
      gradeId: initialValues?.gradeId ? String(initialValues.gradeId) : '',
      registrationOpensAt: initialValues?.registrationOpensAt ?? '',
      registrationClosesAt: initialValues?.registrationClosesAt ?? '',
    },
    validationSchema,
    onSubmit: (values) => {
      const error = validatePapers(papers);
      if (error) {
        setPapersError(error);
        return;
      }
      const gradeId = Number(values.gradeId);
      const dto: CreateExamDto = {
        code: values.code.trim(),
        name: values.name.trim(),
        session: values.session.trim(),
        schoolLevel: levelForGrade(gradeId),
        gradeId,
        registrationOpensAt: values.registrationOpensAt,
        registrationClosesAt: values.registrationClosesAt,
        papers: papers.map((p) => ({
          subject: p.subject.trim(),
          totalMarks: Number(p.totalMarks),
          paperDate: p.paperDate,
          paperType: p.paperType,
        })),
      };
      onSubmit(dto);
    },
  });

  const fieldError = (name: keyof ExamFormValues): string | undefined =>
    formik.touched[name] ? formik.errors[name] : undefined;

  const handlePapersChange = (next: PaperDraft[]): void => {
    setPapers(next);
    if (papersError) setPapersError(undefined);
  };

  const gridClass = 'grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 lg:grid-cols-3';

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="space-y-10">
      <section>
        <SectionHeading icon={GraduationCap}>Exam Details</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="name"
            name="name"
            label="Exam Name"
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
            id="gradeId"
            name="gradeId"
            label="Grade"
            options={GRADE_OPTIONS}
            required
            value={formik.values.gradeId}
            onChange={(value) => void formik.setFieldValue('gradeId', value)}
            onBlur={() => void formik.setFieldTouched('gradeId', true)}
            error={fieldError('gradeId')}
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={Calendar}>Registration Window</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="registrationOpensAt"
            name="registrationOpensAt"
            label="Opens On"
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
            label="Closes On"
            type="date"
            value={formik.values.registrationClosesAt}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('registrationClosesAt')}
            required
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={FileText}>Papers</SectionHeading>
        <PapersEditor papers={papers} onChange={handlePapersChange} error={papersError} />
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
