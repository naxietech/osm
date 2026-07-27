/**
 * ESheetTemplateForm (organism) — build or edit a reusable e-sheet template.
 *
 * Two levels, because the marked unit is the sub-part, not the question. A question card carries
 * the number, the type, its own sub-part numbering (letters or roman — per question, since one
 * paper often mixes them) and, for MCQ, how many bubbles print. Inside it sits one explicit row
 * per sub-part with its own writing space and marks; a typed sub-part count is applied on a
 * button press, never per keystroke, so raising 5 to 12 cannot delete rows on the way through.
 *
 * The examiner never types a page number. Writing space is given in ruled LINES and the layout
 * engine decides which side each answer lands on; the form shows a rough "≈ ½ side" hint beside
 * each count and a live page total so the consequence is visible while typing. That total counts
 * the information cover as page 1 — questions start on page 2, each on a page of its own.
 *
 * MCQ rows show no line count — a bubble row is a fixed height — and default to 1 mark.
 *
 * Presentational and self-contained: Formik + Yup own the draft and validation (see
 * institute-category-form for the FieldArray reference), and `onSave` receives a parsed DTO.
 * `onDraftChange` reports the draft upward so the PAGE can render the preview beside the form —
 * an organism may not import another organism, and that boundary is deliberate here.
 *
 * Every number is held as a STRING while editing (a half-typed "1" must not become NaN) and
 * parsed once on submit. Duplicate question numbers are checked outside Yup because the rule
 * spans rows rather than validating one.
 */
import React, { useEffect, useMemo } from 'react';

import { FieldArray, FormikProvider, useFormik } from 'formik';
import * as Yup from 'yup';

import {
  ANSWER_SPACE_LABELS,
  ANSWER_SPACE_ORDER,
  type CreateESheetTemplateDto,
  DEFAULT_ANSWER_SPACE,
  DEFAULT_MCQ_OPTION_COUNT,
  type ESheetAnswerSpace,
  type ESheetQuestionType,
  type ESheetTemplate,
  type ESheetTemplateAnswerInput,
  type ESheetTemplateQuestionInput,
  type SubPartLabelStyle,
  answerLabel,
  mcqAnswerLabel,
  questionTypeUsesLines,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { FileSpreadsheet, FileText, Plus, Trash2 } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { Textarea } from '@/design-system/atoms/textarea';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';
import { layoutTemplate, spaceSummary } from '@/lib/e-sheet-layout';

/**
 * One sub-part row. `space` always holds a real value rather than a "same as question" blank —
 * an examiner should read a row and know what it is, without cross-referencing the question
 * above it. Changing the question's default rewrites every row that still matches the old one.
 */
export interface ESheetAnswerDraft {
  space: ESheetAnswerSpace;
  maxMarks: string;
}

export interface ESheetQuestionDraft {
  questionNo: string;
  type: ESheetQuestionType;
  /** MCQ only. */
  optionCount: string;
  /** How this question's sub-parts are numbered — per question, not per sheet. */
  subPartLabelStyle: SubPartLabelStyle;
  /** Writing space every sub-part gets unless it overrides it. Written types only. */
  defaultSpace: ESheetAnswerSpace;
  /** How many sub-part rows the examiner wants; applied to `answers` on demand. */
  subPartCount: string;
  answers: ESheetAnswerDraft[];
}

export interface ESheetTemplateFormValue {
  name: string;
  instructions: string;
  questions: ESheetQuestionDraft[];
}

interface ESheetTemplateFormValues extends ESheetTemplateFormValue {
  /** "How many questions" — drives the generate button only; never saved. */
  questionCount: string;
}

const QUESTION_TYPE_LABELS: Record<ESheetQuestionType, string> = {
  mcq: 'MCQ',
  'short-answer': 'Short answer',
  'long-answer': 'Long answer',
};

export const QUESTION_TYPE_OPTIONS: SelectOption[] = (
  Object.keys(QUESTION_TYPE_LABELS) as ESheetQuestionType[]
).map((type) => ({ value: type, label: QUESTION_TYPE_LABELS[type] }));

const OPTION_COUNT_OPTIONS: SelectOption[] = [2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `${n} options`,
}));

const SPACE_OPTIONS: SelectOption[] = ANSWER_SPACE_ORDER.map((space) => ({
  value: space,
  label: `${ANSWER_SPACE_LABELS[space]} — ${spaceSummary(space)}`,
}));

const LABEL_STYLE_OPTIONS: SelectOption[] = [
  { value: 'alpha', label: 'Letters — (a) (b) (c)' },
  { value: 'roman', label: 'Roman — (i) (ii) (iii)' },
];

/** Generous upper bounds — enough for any real paper, tight enough to catch a fat finger. */
const LIMITS = {
  questions: 100,
  subParts: 60,
  marks: 500,
  instructions: 500,
} as const;

/** Parse a whole number, or null when the text isn't one. */
function toInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

/** Lenient parse for the live preview, where a half-filled row should still draw. */
function toIntOrZero(value: string): number {
  return toInt(value) ?? 0;
}

export function emptyAnswer(
  type: ESheetQuestionType,
  space: ESheetAnswerSpace = DEFAULT_ANSWER_SPACE,
): ESheetAnswerDraft {
  return questionTypeUsesLines(type) ? { space, maxMarks: '' } : { space, maxMarks: '1' };
}

export function emptyQuestion(questionNo: number): ESheetQuestionDraft {
  return {
    questionNo: String(questionNo),
    type: 'mcq',
    optionCount: String(DEFAULT_MCQ_OPTION_COUNT),
    subPartLabelStyle: 'alpha',
    defaultSpace: DEFAULT_ANSWER_SPACE,
    subPartCount: '1',
    answers: [emptyAnswer('mcq')],
  };
}

/** Whole-number field between `min` and `max`, reported with a field-specific label. */
function intField(label: string, min: number, max: number): Yup.StringSchema {
  return Yup.string()
    .trim()
    .required(`${label} is required`)
    .test('whole-number', `${label} must be a whole number`, (value) => {
      if (value === undefined || value.trim() === '') return true; // `required` reports this
      return toInt(value) !== null;
    })
    .test('in-range', `${label} must be between ${min} and ${max}`, (value) => {
      const parsed = value === undefined ? null : toInt(value);
      if (parsed === null) return true; // the other tests report this
      return parsed >= min && parsed <= max;
    });
}

/** Space is a picker, so it can only ever hold a valid value; only marks need checking. */
const ANSWER_SCHEMA = Yup.object({
  space: Yup.string().oneOf(ANSWER_SPACE_ORDER),
  maxMarks: intField('Marks', 1, LIMITS.marks),
});

/** Errors for one sub-part row, as Formik holds them. */
type AnswerErrors = Partial<Record<keyof ESheetAnswerDraft, string>>;
type AnswerTouched = Partial<Record<keyof ESheetAnswerDraft, boolean>>;

interface QuestionErrors {
  questionNo?: string;
  type?: string;
  optionCount?: string;
  subPartCount?: string;
  defaultSpace?: string;
  answers?: AnswerErrors[] | string;
}
interface QuestionTouched {
  questionNo?: boolean;
  type?: boolean;
  optionCount?: boolean;
  subPartCount?: boolean;
  defaultSpace?: boolean;
  answers?: AnswerTouched[];
}

/** Build a template the preview can draw from a partly-filled draft. */
function draftToPreviewTemplate(values: ESheetTemplateFormValues): ESheetTemplate {
  return {
    id: 'draft',
    name: values.name.trim(),
    ...(values.instructions.trim() === '' ? {} : { instructions: values.instructions.trim() }),
    isActive: true,
    createdAt: '',
    questions: values.questions.map((question, qi) => ({
      id: `draft_q_${qi}`,
      questionNo: toIntOrZero(question.questionNo),
      type: question.type,
      subPartLabelStyle: question.subPartLabelStyle,
      ...(questionTypeUsesLines(question.type)
        ? { defaultSpace: question.defaultSpace }
        : { optionCount: toInt(question.optionCount) ?? DEFAULT_MCQ_OPTION_COUNT }),
      answers: question.answers.map((answer, ai) => ({
        id: `draft_a_${qi}_${ai}`,
        maxMarks: toIntOrZero(answer.maxMarks),
        ...(questionTypeUsesLines(question.type) ? { space: answer.space } : {}),
      })),
    })),
  };
}

/** Convert the drafts to DTO rows; null if any number fails to parse (Yup blocks that). */
function toQuestionInputs(questions: ESheetQuestionDraft[]): ESheetTemplateQuestionInput[] | null {
  const inputs: ESheetTemplateQuestionInput[] = [];
  for (const question of questions) {
    const questionNo = toInt(question.questionNo);
    if (questionNo === null) return null;
    const usesLines = questionTypeUsesLines(question.type);

    let optionCount: number | undefined;
    if (!usesLines) {
      const parsed = toInt(question.optionCount);
      if (parsed === null) return null;
      optionCount = parsed;
    }

    const answers: ESheetTemplateAnswerInput[] = [];
    for (const answer of question.answers) {
      const maxMarks = toInt(answer.maxMarks);
      if (maxMarks === null) return null;
      if (!usesLines) {
        answers.push({ maxMarks });
        continue;
      }
      answers.push({ maxMarks, space: answer.space });
    }

    inputs.push({
      questionNo,
      type: question.type,
      subPartLabelStyle: question.subPartLabelStyle,
      ...(usesLines ? { defaultSpace: question.defaultSpace } : {}),
      ...(optionCount === undefined ? {} : { optionCount }),
      answers,
    });
  }
  return inputs;
}

export interface ESheetTemplateFormProps {
  /** Existing values when editing; omitted to start a blank template. */
  initialValue?: ESheetTemplateFormValue;
  mode: 'create' | 'edit';
  /** Flags a duplicate template name (the parent excludes the row being edited). */
  isNameTaken: (name: string) => boolean;
  onSave: (dto: CreateESheetTemplateDto) => void;
  onCancel: () => void;
  /** Reports the draft so the page can render the preview alongside. */
  onDraftChange?: (template: ESheetTemplate) => void;
  isSubmitting?: boolean;
  /** Message from the parent's failed save (e.g. the name was taken). */
  submitError?: string;
}

/** Iconed section heading (matches ExamForm / InstituteForm). */
function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: typeof FileText;
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

export function ESheetTemplateForm({
  initialValue,
  mode,
  isNameTaken,
  onSave,
  onCancel,
  onDraftChange,
  isSubmitting = false,
  submitError,
}: ESheetTemplateFormProps): React.ReactElement {
  const validationSchema = useMemo(
    () =>
      Yup.object({
        name: Yup.string()
          .trim()
          .min(3, 'Name must be at least 3 characters')
          .max(100, 'Name is too long')
          .required('Template name is required')
          .test('unique-name', 'A template with this name already exists.', (value) => {
            if (!value || value.trim() === '') return true;
            return !isNameTaken(value.trim());
          }),
        instructions: Yup.string().max(LIMITS.instructions, 'Instructions are too long'),
        questionCount: Yup.string(),
        questions: Yup.array()
          .of(
            Yup.object({
              questionNo: intField('Question number', 1, LIMITS.questions),
              type: Yup.string()
                .oneOf(Object.keys(QUESTION_TYPE_LABELS), 'Pick a question type')
                .required('Pick a question type'),
              // `optionCount` and the answer shape both depend on the question's own type,
              // which is a sibling here — so `when` can reach it.
              optionCount: Yup.string().when('type', {
                is: (type: string) => !questionTypeUsesLines(type as ESheetQuestionType),
                then: () => intField('Options', 2, 6),
                otherwise: (schema) => schema,
              }),
              // Guards the gap between a typed count and the rows actually on screen, so a
              // count the examiner forgot to Apply can never be silently ignored on save.
              subPartCount: intField('Sub-parts', 1, LIMITS.subParts).test(
                'applied',
                'Press Apply to use this count',
                function (value) {
                  const parsed = value === undefined ? null : toInt(value);
                  if (parsed === null) return true; // the other tests report this
                  const parent = this.parent as ESheetQuestionDraft;
                  return parsed === parent.answers.length;
                },
              ),
              defaultSpace: Yup.string().oneOf(ANSWER_SPACE_ORDER).required(),
              answers: Yup.array()
                .min(1, 'Add at least one sub-part.')
                .of(ANSWER_SCHEMA)
                .required(),
            }),
          )
          .min(1, 'Add at least one question.')
          .required(),
      }),
    [isNameTaken],
  );

  const formik = useFormik<ESheetTemplateFormValues>({
    initialValues: {
      name: initialValue?.name ?? '',
      instructions: initialValue?.instructions ?? '',
      questionCount: String(initialValue?.questions.length ?? ''),
      questions: initialValue?.questions ?? [],
    },
    validationSchema,
    onSubmit: (values) => {
      const questions = toQuestionInputs(values.questions);
      if (!questions) return; // unreachable once Yup passes; never save half-parsed rows
      onSave({
        name: values.name.trim(),
        ...(values.instructions.trim() === '' ? {} : { instructions: values.instructions.trim() }),
        questions,
      });
    },
  });

  const { questions } = formik.values;

  /** Draft for the preview. Memoised on `values`, so the effect below can't loop. */
  const previewTemplate = useMemo(() => draftToPreviewTemplate(formik.values), [formik.values]);
  const layout = useMemo(() => layoutTemplate(previewTemplate), [previewTemplate]);

  useEffect(() => {
    onDraftChange?.(previewTemplate);
  }, [previewTemplate, onDraftChange]);

  /**
   * Questions repeating a number already used above. Only the later one is flagged — the first
   * use is the legitimate one, so the examiner fixes the copy, not the original.
   */
  const duplicateIndexes = useMemo(() => {
    const firstSeenAt = new Set<number>();
    const duplicates = new Set<number>();
    questions.forEach((question, index) => {
      const parsed = toInt(question.questionNo);
      if (parsed === null) return;
      if (firstSeenAt.has(parsed)) duplicates.add(index);
      else firstSeenAt.add(parsed);
    });
    return duplicates;
  }, [questions]);

  /** A field only complains once engaged with, or once submit has been attempted. */
  const engaged = (touched: boolean | undefined): boolean =>
    Boolean(touched) || formik.submitCount > 0;

  const nameError = engaged(formik.touched.name) ? formik.errors.name : undefined;
  const instructionsError = engaged(formik.touched.instructions)
    ? formik.errors.instructions
    : undefined;

  /** Formik's nested error/touched trees, narrowed for one question. */
  const questionErrorsAt = (index: number): QuestionErrors | undefined => {
    const list = formik.errors.questions;
    if (!Array.isArray(list)) return undefined;
    const entry = list[index];
    // FormikErrors<ESheetQuestionDraft> is structurally this shape.
    return typeof entry === 'object' && entry !== null ? (entry as QuestionErrors) : undefined;
  };
  const questionTouchedAt = (index: number): QuestionTouched | undefined => {
    const list = formik.touched.questions;
    if (!Array.isArray(list)) return undefined;
    const entry: unknown = list[index];
    return typeof entry === 'object' && entry !== null ? (entry as QuestionTouched) : undefined;
  };

  const questionError = (
    index: number,
    key: 'questionNo' | 'type' | 'optionCount' | 'subPartCount',
  ): string | undefined => {
    if (!engaged(questionTouchedAt(index)?.[key])) return undefined;
    return questionErrorsAt(index)?.[key];
  };

  const answerError = (
    qi: number,
    ai: number,
    key: keyof ESheetAnswerDraft,
  ): string | undefined => {
    const answers = questionErrorsAt(qi)?.answers;
    if (!Array.isArray(answers)) return undefined;
    if (!engaged(questionTouchedAt(qi)?.answers?.[ai]?.[key])) return undefined;
    return answers[ai]?.[key];
  };

  /** "Add at least one sub-part." — the array-level rule for one question. */
  const answersListError = (qi: number): string | undefined => {
    const answers = questionErrorsAt(qi)?.answers;
    return formik.submitCount > 0 && typeof answers === 'string' ? answers : undefined;
  };

  /** Editor-level message: the "add at least one question" rule. */
  const listError =
    formik.submitCount > 0 && typeof formik.errors.questions === 'string'
      ? formik.errors.questions
      : undefined;

  const nextQuestionNo = (): number => {
    const used = questions.map((q) => toInt(q.questionNo) ?? 0);
    return Math.max(0, ...used) + 1;
  };

  /** Grow or shrink the question list to the typed count, keeping filled rows. */
  const generateQuestions = (): void => {
    const count = toInt(formik.values.questionCount);
    if (count === null || count < 1 || count > LIMITS.questions) return;
    const next =
      count <= questions.length
        ? questions.slice(0, count)
        : [
            ...questions,
            ...Array.from({ length: count - questions.length }, (_, i) =>
              emptyQuestion(questions.length + i + 1),
            ),
          ];
    void formik.setFieldValue('questions', next, true);
  };

  /**
   * Resize one question's sub-part rows to its typed count, keeping filled rows.
   *
   * Applied on a button press rather than on every keystroke: raising 5 to 12 passes through
   * "1", and resizing on each character would delete rows 2–5 on the way. The visible rows are
   * therefore always exactly what will be saved.
   */
  /** Can this question's typed count actually be applied? Also gates its Apply button. */
  const canApplySubPartCount = (question: ESheetQuestionDraft | undefined): boolean => {
    if (!question) return false;
    const count = toInt(question.subPartCount);
    if (count === null || count < 1 || count > LIMITS.subParts) return false;
    return count !== question.answers.length;
  };

  const applySubPartCount = (qi: number): void => {
    const question = questions[qi];
    if (!canApplySubPartCount(question) || !question) return;
    const count = toInt(question.subPartCount);
    if (count === null) return;
    const current = question.answers;
    const next =
      count < current.length
        ? current.slice(0, count)
        : [
            ...current,
            ...Array.from({ length: count - current.length }, () =>
              emptyAnswer(question.type, question.defaultSpace),
            ),
          ];
    void formik.setFieldValue(`questions[${qi}].answers`, next, true);
  };

  /**
   * The question-level picker sets every sub-part below it. Rows that were deliberately given a
   * different size are left alone, so a bulk change never silently undoes an override.
   */
  const setDefaultSpace = (qi: number, space: ESheetAnswerSpace): void => {
    const question = questions[qi];
    if (!question) return;
    const previous = question.defaultSpace;
    void formik.setFieldValue(
      `questions[${qi}]`,
      {
        ...question,
        defaultSpace: space,
        answers: question.answers.map((answer) =>
          answer.space === previous ? { ...answer, space } : answer,
        ),
      },
      true,
    );
  };

  /**
   * Switching type changes what the rows show, not what they hold: a bubble row ignores its
   * space, but the value stays put so switching back restores the examiner's choice.
   */
  const setQuestionType = (qi: number, type: ESheetQuestionType): void => {
    const question = questions[qi];
    if (!question) return;
    void formik.setFieldValue(`questions[${qi}]`, { ...question, type }, true);
  };

  const generateCount = toInt(formik.values.questionCount);
  const canGenerate =
    generateCount !== null && generateCount >= 1 && generateCount <= LIMITS.questions;
  const hasDuplicates = duplicateIndexes.size > 0;

  return (
    <FormikProvider value={formik}>
      <form onSubmit={formik.handleSubmit} noValidate className="space-y-10">
        <section>
          <SectionHeading icon={FileSpreadsheet}>Template Details</SectionHeading>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
            <FormField
              id="template-name"
              name="name"
              label="Template Name"
              containerClassName="md:col-span-2"
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={nameError}
              required
            />
            <FormField
              id="template-question-count"
              name="questionCount"
              label="How many questions"
              inputMode="numeric"
              value={formik.values.questionCount}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
          </div>
          {/* Actions sit at the end of the row rather than between the fields. */}
          <div className="mt-2 flex items-center justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={!canGenerate}
              onClick={generateQuestions}
            >
              Generate questions
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to {LIMITS.questions} questions. Generating keeps the questions you have already
            filled in; lowering the count removes them from the end.
          </p>

          <div className="mt-4">
            <label
              htmlFor="template-instructions"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Instructions (optional)
            </label>
            <Textarea
              id="template-instructions"
              name="instructions"
              rows={3}
              value={formik.values.instructions}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              aria-describedby="template-instructions-hint"
            />
            <p id="template-instructions-hint" className="mt-1 text-xs text-muted-foreground">
              Printed on page 1; its space is reserved automatically. Leave blank for no block.
            </p>
            {instructionsError && (
              <p className="mt-1 text-xs text-danger-foreground">{instructionsError}</p>
            )}
          </div>
        </section>

        <section>
          <SectionHeading icon={FileText}>Questions &amp; Answers</SectionHeading>

          <FieldArray name="questions">
            {(helpers) => (
              <div className="space-y-5">
                {questions.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    No questions yet. Enter how many the paper has and generate them, or add one at
                    a time.
                  </p>
                )}

                {questions.map((question, qi) => {
                  const usesLines = questionTypeUsesLines(question.type);
                  const questionMarks = question.answers.reduce(
                    (sum, a) => sum + toIntOrZero(a.maxMarks),
                    0,
                  );

                  return (
                    <div
                      // eslint-disable-next-line react/no-array-index-key -- draft rows have no stable id
                      key={qi}
                      className="rounded-xl border border-border bg-muted/30 p-4"
                    >
                      {/* Fields WRAP rather than squeeze. Each one carries a minimum width and
                          grows into whatever is left, so narrowing the window pushes a field onto
                          the next line instead of shrinking every select until its text is cut
                          off — which is what a two-column layout on a small laptop used to do. */}
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="w-20 shrink-0">
                          <FormField
                            id={`question-${qi}-no`}
                            name={`questions[${qi}].questionNo`}
                            label="Q No"
                            inputMode="numeric"
                            value={question.questionNo}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={
                              duplicateIndexes.has(qi)
                                ? 'Duplicate'
                                : questionError(qi, 'questionNo')
                            }
                            required
                          />
                        </div>
                        <div className="w-24 shrink-0">
                          <FormField
                            id={`question-${qi}-sub-parts`}
                            name={`questions[${qi}].subPartCount`}
                            label="Sub-parts"
                            inputMode="numeric"
                            value={question.subPartCount}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={questionError(qi, 'subPartCount')}
                            required
                          />
                        </div>
                        <div className="min-w-[11rem] flex-1">
                          <SelectField
                            id={`question-${qi}-type`}
                            label="Type"
                            options={QUESTION_TYPE_OPTIONS}
                            value={question.type}
                            onChange={(value) => setQuestionType(qi, value as ESheetQuestionType)}
                            onBlur={() =>
                              void formik.setFieldTouched(`questions[${qi}].type`, true, false)
                            }
                            error={questionError(qi, 'type')}
                            required
                          />
                        </div>
                        {!usesLines && (
                          <div className="min-w-[9rem] flex-1">
                            <SelectField
                              id={`question-${qi}-options`}
                              label="Bubbles"
                              options={OPTION_COUNT_OPTIONS}
                              value={question.optionCount}
                              onChange={(value) =>
                                void formik.setFieldValue(
                                  `questions[${qi}].optionCount`,
                                  value,
                                  true,
                                )
                              }
                              error={questionError(qi, 'optionCount')}
                              required
                            />
                          </div>
                        )}
                        {usesLines && (
                          <div className="min-w-[15rem] flex-1">
                            <SelectField
                              id={`question-${qi}-default-space`}
                              label="Space for every sub-part"
                              options={SPACE_OPTIONS}
                              value={question.defaultSpace}
                              onChange={(value) => setDefaultSpace(qi, value as ESheetAnswerSpace)}
                              required
                            />
                          </div>
                        )}
                        {question.answers.length > 1 && (
                          <div className="min-w-[12rem] flex-1">
                            <SelectField
                              id={`question-${qi}-label-style`}
                              label="Sub-part numbering"
                              options={LABEL_STYLE_OPTIONS}
                              value={question.subPartLabelStyle}
                              onChange={(value) =>
                                void formik.setFieldValue(
                                  `questions[${qi}].subPartLabelStyle`,
                                  value as SubPartLabelStyle,
                                  true,
                                )
                              }
                              required
                            />
                          </div>
                        )}
                        {/* Actions live at the END of the row, never mixed in with the
                            inputs, and are fixed to the field height so they sit level. */}
                        <div className="ml-auto flex h-[60px] items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="field"
                            disabled={!canApplySubPartCount(question)}
                            onClick={() => applySubPartCount(qi)}
                          >
                            Apply
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="field"
                            aria-label={`Remove question ${qi + 1}`}
                            onClick={() => helpers.remove(qi)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </div>

                      {/* Sub-part rows — a table of inputs, so the column headers carry the
                          visible labels and each input carries its own accessible name. */}
                      <div className="mt-3 rounded-lg border border-border bg-card">
                        <div
                          className={`grid gap-3 border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground ${
                            usesLines
                              ? 'grid-cols-[8.5rem_minmax(0,1fr)_5.5rem]'
                              : 'grid-cols-[3.5rem_minmax(0,1fr)]'
                          }`}
                        >
                          <span>Answer</span>
                          {usesLines && <span>Space</span>}
                          <span>Marks</span>
                        </div>

                        <div className="divide-y divide-border">
                          {question.answers.map((answer, ai) => {
                            // Two labels on purpose: the row SHOWS what the sheet prints (an MCQ
                            // row is just "i."), while each input's accessible name keeps the
                            // question number, so a screen reader landing on a field mid-form is
                            // never told only "i. marks".
                            const fieldLabel = answerLabel(
                              toIntOrZero(question.questionNo),
                              ai,
                              question.answers.length,
                              question.subPartLabelStyle,
                            );
                            const label = usesLines
                              ? fieldLabel
                              : mcqAnswerLabel(ai, question.subPartLabelStyle);
                            const marksError = answerError(qi, ai, 'maxMarks');

                            return (
                              <div
                                // eslint-disable-next-line react/no-array-index-key -- draft rows have no stable id
                                key={ai}
                                className={`grid items-center gap-3 px-3 py-2 ${
                                  usesLines
                                    ? 'grid-cols-[8.5rem_minmax(0,1fr)_5.5rem]'
                                    : 'grid-cols-[3.5rem_minmax(0,1fr)]'
                                }`}
                              >
                                <span className="truncate font-mono text-xs text-muted-foreground">
                                  {label}
                                </span>

                                {usesLines && (
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <select
                                      className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:flex-none"
                                      aria-label={`${fieldLabel} writing space`}
                                      name={`questions[${qi}].answers[${ai}].space`}
                                      value={answer.space}
                                      onChange={formik.handleChange}
                                    >
                                      {ANSWER_SPACE_ORDER.map((space) => (
                                        <option key={space} value={space}>
                                          {ANSWER_SPACE_LABELS[space]}
                                        </option>
                                      ))}
                                    </select>
                                    <span className="text-xs text-muted-foreground">
                                      {spaceSummary(answer.space)}
                                    </span>
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <Input
                                    className="h-10 w-full"
                                    aria-label={`${fieldLabel} marks`}
                                    inputMode="numeric"
                                    name={`questions[${qi}].answers[${ai}].maxMarks`}
                                    value={answer.maxMarks}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    error={Boolean(marksError)}
                                  />
                                  {marksError && (
                                    <p className="mt-1 text-xs text-danger-foreground">
                                      {marksError}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {answersListError(qi) && (
                        <p className="mt-2 text-xs text-danger-foreground">
                          {answersListError(qi)}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-muted-foreground">
                        {question.answers.length} answer
                        {question.answers.length === 1 ? '' : 's'} · {questionMarks} marks
                        {usesLines
                          ? ` · sets every sub-part below; change any that need more`
                          : ' · machine-read bubbles, no checker'}
                      </p>
                    </div>
                  );
                })}

                {listError && <p className="text-xs text-danger-foreground">{listError}</p>}

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => helpers.push(emptyQuestion(nextQuestionNo()))}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add Question
                </Button>

                {questions.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{layout.answerCount}</span> answer
                    {layout.answerCount === 1 ? '' : 's'} ·{' '}
                    <span className="font-medium text-foreground">{layout.totalMarks}</span> total
                    marks ·{' '}
                    <span className="font-medium text-foreground">{layout.pages.length}</span> page
                    {layout.pages.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            )}
          </FieldArray>
        </section>

        {(submitError || hasDuplicates) && (
          <p role="alert" className="text-sm text-danger-foreground">
            {submitError ?? 'Give every question its own number before saving.'}
          </p>
        )}

        <div className="flex gap-3 border-t border-border pt-6">
          <Button type="submit" size="lg" isLoading={isSubmitting} disabled={hasDuplicates}>
            {mode === 'create' ? 'Create Template' : 'Save Changes'}
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </FormikProvider>
  );
}

export default ESheetTemplateForm;
