/**
 * InstituteCategoryForm (organism) — the create/edit form for an institute category,
 * including the dynamic registration-question builder and a live preview of how those
 * questions appear on the public registration form.
 *
 * Self-contained and presentational: Formik + Yup own the working draft (scalar fields
 * + questions) and validation, and `onSave` receives a cleaned value. The parent page
 * owns the service calls (create vs update) — mirroring InstituteForm / ExamForm.
 * Remount it (via a React `key`) to reset the draft when switching edit targets.
 *
 * The question rows use Formik's FieldArray, but each row still carries its own `key`:
 * Formik does not solve React keying, and an index key loses focus/state on reorder.
 */
import React, { useRef } from 'react';

import { FieldArray, FormikProvider, useFormik } from 'formik';
import * as Yup from 'yup';

import {
  type CategoryQuestionInput,
  type CategoryQuestionType,
  questionTypeHasOptions,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Checkbox } from '@/design-system/atoms/checkbox';
import { ChevronDown, ChevronUp, Plus, Upload, X } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

/**
 * A question row while editing.
 *
 * `key` is a React key — stable across reorders, never persisted. `id` is the opposite: it is the
 * database's permanent identity for a question, and **it must survive a round trip through this
 * form**. Every institute answer points at a question by id, and the API's reconciler reads a
 * question arriving without one as brand new — so dropping it here would silently re-create the
 * whole list on every save and strand every answer already given. A question being created for
 * the first time genuinely has no id; that is the only time it may be absent.
 */
interface QuestionDraft {
  key: string;
  id?: string;
  text: string;
  type: CategoryQuestionType;
  required: boolean;
  options: string[];
}

/** Cleaned value emitted on save — the parent maps this onto its create/update DTO. */
export interface InstituteCategoryFormValue {
  code: string;
  name: string;
  description: string;
  questions: CategoryQuestionInput[];
}

export interface InstituteCategoryFormProps {
  /** Existing category values when editing; omitted for the create flow. */
  initialValue?: InstituteCategoryFormValue;
  mode: 'create' | 'edit';
  onSave: (value: InstituteCategoryFormValue) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'text', label: 'Text box' },
  { value: 'radio', label: 'Radio (choose one)' },
  { value: 'checkbox', label: 'Checkbox (choose many)' },
  { value: 'select', label: 'Dropdown' },
  { value: 'file', label: 'File upload' },
];

/** Validate one question; returns an error string, or null when it's fine (or blank). */
function questionError(q: QuestionDraft): string | null {
  // Blank questions are dropped silently on save, so they aren't errors.
  if (q.text.trim().length === 0) return null;
  if (questionTypeHasOptions(q.type)) {
    const opts = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (opts.length < 2) return 'Add at least 2 answer options.';
    const seen = opts.map((o) => o.toLowerCase());
    if (new Set(seen).size !== seen.length) return 'Answer options must be unique.';
  }
  return null;
}

interface CategoryFormValues {
  code: string;
  name: string;
  description: string;
  questions: QuestionDraft[];
}

/**
 * Gates the save button. Each question row is judged by `questionError`, which stays the
 * single definition of what makes a row valid (the row's own message is derived from it
 * too — see `questionErrorAt`).
 */
const validationSchema = Yup.object({
  code: Yup.string().trim().required('Code is required'),
  name: Yup.string().trim().required('Name is required'),
  description: Yup.string(),
  questions: Yup.array().of(
    Yup.object({
      key: Yup.string().defined(),
      text: Yup.string().defined(),
      type: Yup.string().defined(),
      required: Yup.boolean().defined(),
      options: Yup.array().of(Yup.string().defined()).defined(),
    }).test('question-valid', 'Invalid question', (value, ctx) => {
      // Yup runs object tests against the partially-cast row, so normalise before
      // handing it to the domain rule — an absent field just means "not filled in".
      if (!value) return true;
      const message = questionError({
        key: '',
        text: typeof value.text === 'string' ? value.text : '',
        type: value.type as CategoryQuestionType,
        required: Boolean(value.required),
        options: Array.isArray(value.options)
          ? value.options.filter((o): o is string => typeof o === 'string')
          : [],
      });
      return message === null ? true : ctx.createError({ message });
    }),
  ),
});

export function InstituteCategoryForm({
  initialValue,
  mode,
  onSave,
  onCancel,
}: InstituteCategoryFormProps): React.ReactElement {
  const keySeq = useRef(0);
  const nextKey = (): string => {
    keySeq.current += 1;
    return `q${keySeq.current}`;
  };

  const formik = useFormik<CategoryFormValues>({
    initialValues: {
      code: initialValue?.code ?? '',
      name: initialValue?.name ?? '',
      description: initialValue?.description ?? '',
      questions: (initialValue?.questions ?? []).map((q) => ({
        key: nextKey(),
        ...(q.id ? { id: q.id } : {}),
        text: q.text,
        type: q.type,
        required: q.required ?? false,
        options: q.options ?? [],
      })),
    },
    validationSchema,
    // The save button reflects validity from the first render, before any field is touched.
    validateOnMount: true,
    onSubmit: (values) => {
      const cleaned: CategoryQuestionInput[] = values.questions
        .filter((q) => q.text.trim().length > 0)
        .map((q) => ({
          ...(q.id ? { id: q.id } : {}),
          text: q.text.trim(),
          type: q.type,
          required: q.required,
          ...(questionTypeHasOptions(q.type)
            ? { options: q.options.map((o) => o.trim()).filter((o) => o.length > 0) }
            : {}),
        }));
      onSave({
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description.trim(),
        questions: cleaned,
      });
    },
  });

  const questions = formik.values.questions;

  const mutateQuestion = (i: number, patch: Partial<QuestionDraft>): void => {
    const current = questions[i];
    if (!current) return;
    void formik.setFieldValue(`questions[${i}]`, { ...current, ...patch }, true);
  };

  const setQuestionType = (i: number, type: CategoryQuestionType): void => {
    const current = questions[i];
    if (!current) return;
    // Seed two blank options when switching to a choice type; clear otherwise.
    const options = questionTypeHasOptions(type)
      ? current.options.length > 0
        ? current.options
        : ['', '']
      : [];
    mutateQuestion(i, { type, options });
  };

  const setOptions = (qi: number, options: string[]): void => mutateQuestion(qi, { options });

  const addOption = (qi: number): void => setOptions(qi, [...(questions[qi]?.options ?? []), '']);
  const setOption = (qi: number, oi: number, value: string): void =>
    setOptions(
      qi,
      (questions[qi]?.options ?? []).map((o, idx) => (idx === oi ? value : o)),
    );
  const removeOption = (qi: number, oi: number): void =>
    setOptions(
      qi,
      (questions[qi]?.options ?? []).filter((_, idx) => idx !== oi),
    );

  /**
   * The row-level message. Derived from `questionError` rather than read out of
   * `formik.errors`: Yup nests an object-level test error under the row instead of
   * exposing a plain string there. Both paths call the SAME rule, so the message shown
   * and the validity that gates the save button can't disagree.
   */
  const questionErrorAt = (i: number): string | undefined => {
    const q = questions[i];
    return q ? (questionError(q) ?? undefined) : undefined;
  };

  return (
    <FormikProvider value={formik}>
      <form onSubmit={formik.handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="cat-code"
            name="code"
            label="Code"
            value={formik.values.code}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.code ? formik.errors.code : undefined}
            required
          />
          <FormField
            id="cat-name"
            name="name"
            label="Name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name ? formik.errors.name : undefined}
            required
          />
          <FormField
            id="cat-description"
            name="description"
            label="Description"
            value={formik.values.description}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            required={false}
            containerClassName="sm:col-span-2"
          />
        </div>

        {/* Builder + live preview side by side on large screens */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Dynamic questions builder */}
          <FieldArray name="questions">
            {(helpers) => (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Registration Questions
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Questions institutes answer when registering under this category.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      helpers.push({
                        key: nextKey(),
                        text: '',
                        type: 'text',
                        required: false,
                        options: [],
                      })
                    }
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add Question
                  </Button>
                </div>

                {questions.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    No questions yet.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {questions.map((q, i) => (
                      <li key={q.key} className="rounded-lg border border-border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Question {i + 1}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Move question ${i + 1} up`}
                              disabled={i === 0}
                              onClick={() => helpers.swap(i, i - 1)}
                            >
                              <ChevronUp className="h-4 w-4" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Move question ${i + 1} down`}
                              disabled={i === questions.length - 1}
                              onClick={() => helpers.swap(i, i + 1)}
                            >
                              <ChevronDown className="h-4 w-4" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Remove question ${i + 1}`}
                              onClick={() => helpers.remove(i)}
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            aria-label={`Question ${i + 1} text`}
                            value={q.text}
                            onChange={(e) => mutateQuestion(i, { text: e.target.value })}
                            placeholder="e.g. Are you an ed-tech institute?"
                          />
                          <SelectField
                            label="Answer type"
                            options={TYPE_OPTIONS}
                            value={q.type}
                            onChange={(v) => setQuestionType(i, v as CategoryQuestionType)}
                          />
                        </div>

                        <Checkbox
                          labelClassName="mt-3 text-xs text-muted-foreground"
                          checked={q.required}
                          onChange={(e) => mutateQuestion(i, { required: e.target.checked })}
                          label="Required — institute must answer this"
                        />

                        {/* Answer options for choice types */}
                        {questionTypeHasOptions(q.type) && (
                          <div className="mt-3 pl-4">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              Answer options
                            </p>
                            <ul className="space-y-2">
                              {q.options.map((opt, oi) => (
                                // eslint-disable-next-line react/no-array-index-key -- option rows have no stable id
                                <li key={oi} className="flex items-center gap-2">
                                  <span className="w-5 shrink-0 text-xs text-muted-foreground">
                                    {oi + 1}.
                                  </span>
                                  <Input
                                    aria-label={`Question ${i + 1} option ${oi + 1}`}
                                    value={opt}
                                    onChange={(e) => setOption(i, oi, e.target.value)}
                                    placeholder="e.g. Yes"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Remove option ${oi + 1}`}
                                    onClick={() => removeOption(i, oi)}
                                  >
                                    <X className="h-4 w-4" aria-hidden />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="mt-2"
                              onClick={() => addOption(i)}
                            >
                              <Plus className="h-4 w-4" aria-hidden />
                              Add Option
                            </Button>
                          </div>
                        )}

                        {questionErrorAt(i) && (
                          <p className="mt-2 text-xs font-medium text-danger-foreground">
                            {questionErrorAt(i)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </FieldArray>

          {/* Live preview — what the institute sees on the public form */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Preview</h3>
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <p className="mb-4 text-xs text-muted-foreground">
                {formik.values.name.trim() || 'Category'} — how the questions appear to an
                institute.
              </p>
              <QuestionsPreview questions={questions} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!formik.isValid}>
            {mode === 'edit' ? 'Save Changes' : 'Add Category'}
          </Button>
        </div>
      </form>
    </FormikProvider>
  );
}

/** Read-only render of the questions exactly as the public registration form shows them. */
function QuestionsPreview({ questions }: { questions: QuestionDraft[] }): React.ReactElement {
  const answerable = questions.filter((q) => q.text.trim().length > 0);
  if (answerable.length === 0) {
    return <p className="text-xs text-muted-foreground">Add a question to see the preview.</p>;
  }
  return (
    <div className="space-y-5">
      {answerable.map((q) => {
        const options = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
        return (
          <div key={q.key}>
            <p className="mb-2 text-sm font-medium text-foreground">
              {q.text.trim()}
              {q.required && <span className="ml-0.5 text-danger-foreground">*</span>}
            </p>
            {q.type === 'text' && (
              <div className="h-9 rounded-md border border-input bg-background px-3 py-2 text-xs text-muted-foreground">
                Your answer
              </div>
            )}
            {q.type === 'file' && (
              <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 text-xs text-muted-foreground">
                <Upload className="h-4 w-4" aria-hidden />
                Choose file
              </div>
            )}
            {q.type === 'select' && (
              <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3 text-xs text-muted-foreground">
                {options[0] ?? 'Select…'}
                <ChevronDown className="h-4 w-4" aria-hidden />
              </div>
            )}
            {(q.type === 'radio' || q.type === 'checkbox') && (
              <div className="flex flex-wrap gap-4">
                {options.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No options yet</span>
                ) : (
                  options.map((opt, oi) => (
                    // eslint-disable-next-line react/no-array-index-key -- preview chips have no stable id
                    <span key={oi} className="flex items-center gap-2 text-sm text-foreground">
                      <span
                        className={`h-4 w-4 border border-input ${
                          q.type === 'radio' ? 'rounded-full' : 'rounded'
                        }`}
                      />
                      {opt}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default InstituteCategoryForm;
