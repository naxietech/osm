/**
 * ExamForm (organism) — create / edit an exam (session) and its papers.
 *
 * Follows the InstituteForm reference: Formik + Yup for the scalar fields, FormField /
 * SelectField controls, iconed sections, submits a typed CreateExamDto. An exam is for
 * a Level + Group; choosing the group pre-fills the papers from that group's curriculum
 * (via `resolveCurriculum`), which the examiner can then adjust (dates / marks). The
 * paper list is handled by the PapersEditor (own React state) and validated on submit.
 */
import React, { useState } from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import type {
  CreateExamDto,
  CreateExamPaperDto,
  CurriculumSubject,
  ExamInstituteScope,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import {
  Building2,
  Calendar,
  FileText,
  GraduationCap,
  type LucideIcon,
} from '@/design-system/atoms/icon';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';
import { type PaperDraft, PapersEditor, emptyPaper } from '@/design-system/organisms/papers-editor';

export interface ExamFormProps {
  initialValues?: Partial<CreateExamDto>;
  /** Levels (Class / Year / Semester) to choose from. */
  levelOptions: SelectOption[];
  /** Valid group options keyed by level id. */
  groupOptionsByLevel: Record<string, SelectOption[]>;
  /** Resolve the curriculum subjects for a level + group (pre-fills the papers). */
  resolveCurriculum: (levelId: string, groupId: string) => CurriculumSubject[];
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
  registrationOpensAt: string;
  registrationClosesAt: string;
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
  levelId: Yup.string().required('Select a level'),
  groupId: Yup.string().required('Select a group'),
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

function curriculumToDraft(subject: CurriculumSubject): PaperDraft {
  return {
    subject: subject.subject,
    totalMarks: subject.defaultTotalMarks != null ? String(subject.defaultTotalMarks) : '',
    paperDate: '',
    paperType: subject.subjectType,
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
  resolveCurriculum,
  instituteOptions,
  lockInstituteScope = false,
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
  const [instituteScope, setInstituteScope] = useState<ExamInstituteScope>(
    initialValues?.instituteScope ?? 'all',
  );
  const [selectedInstituteIds, setSelectedInstituteIds] = useState<string[]>(
    initialValues?.instituteIds ?? [],
  );
  const [scopeError, setScopeError] = useState<string | undefined>(undefined);

  const toggleInstitute = (id: string): void => {
    setScopeError(undefined);
    setSelectedInstituteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const formik = useFormik<ExamFormValues>({
    enableReinitialize: true,
    initialValues: {
      code: initialValues?.code ?? '',
      name: initialValues?.name ?? '',
      session: initialValues?.session ?? '',
      levelId: initialValues?.levelId ?? '',
      groupId: initialValues?.groupId ?? '',
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
      if (instituteScope === 'selected' && selectedInstituteIds.length === 0) {
        setScopeError('Select at least one institute, or choose All institutes.');
        return;
      }
      const dto: CreateExamDto = {
        code: values.code.trim(),
        name: values.name.trim(),
        session: values.session.trim(),
        levelId: values.levelId,
        groupId: values.groupId,
        instituteScope,
        ...(instituteScope === 'selected' ? { instituteIds: selectedInstituteIds } : {}),
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

  /** Pre-fill the papers from the chosen level + group's curriculum. */
  const loadCurriculumPapers = (levelId: string, groupId: string): void => {
    const subjects = resolveCurriculum(levelId, groupId);
    if (subjects.length > 0) setPapers(subjects.map(curriculumToDraft));
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
            id="levelId"
            name="levelId"
            label="Level (Class / Year)"
            options={levelOptions}
            required
            value={formik.values.levelId}
            onChange={(value) => {
              void formik.setFieldValue('levelId', value);
              void formik.setFieldValue('groupId', '');
            }}
            onBlur={() => void formik.setFieldTouched('levelId', true)}
            error={fieldError('levelId')}
          />
          <SelectField
            id="groupId"
            name="groupId"
            label="Group / Program"
            options={groupOptionsByLevel[formik.values.levelId] ?? []}
            disabled={!formik.values.levelId}
            required
            value={formik.values.groupId}
            onChange={(value) => {
              void formik.setFieldValue('groupId', value);
              if (value) loadCurriculumPapers(formik.values.levelId, value);
            }}
            onBlur={() => void formik.setFieldTouched('groupId', true)}
            error={fieldError('groupId')}
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
        <SectionHeading icon={Building2}>Institute Scope</SectionHeading>
        <p className="mb-3 text-xs text-muted-foreground">
          Choose which institutes can register candidates into this exam. The class (level + group)
          still applies to eligibility.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="instituteScope"
              className="h-4 w-4 accent-[var(--brand)]"
              checked={instituteScope === 'all'}
              disabled={lockInstituteScope}
              onChange={() => {
                setInstituteScope('all');
                setScopeError(undefined);
              }}
            />
            All institutes
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="instituteScope"
              className="h-4 w-4 accent-[var(--brand)]"
              checked={instituteScope === 'selected'}
              disabled={lockInstituteScope}
              onChange={() => setInstituteScope('selected')}
            />
            Selected institutes
          </label>

          {instituteScope === 'selected' && (
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {instituteOptions.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-[var(--brand)]"
                    checked={selectedInstituteIds.includes(o.value)}
                    disabled={lockInstituteScope}
                    onChange={() => toggleInstitute(o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          )}
          {scopeError && <p className="text-xs text-danger">{scopeError}</p>}
        </div>
      </section>

      <section>
        <SectionHeading icon={FileText}>Papers</SectionHeading>
        <p className="mb-3 text-xs text-muted-foreground">
          Papers are pre-filled from the selected group&apos;s curriculum — adjust dates and marks
          as needed.
        </p>
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
