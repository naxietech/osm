/**
 * InstituteCategoryForm (organism) — the create/edit form for an institute category,
 * including the dynamic registration-question builder and a live preview of how those
 * questions appear on the public registration form.
 *
 * Self-contained and presentational: it owns the working draft (scalar fields +
 * questions), validates it, and calls `onSave` with a cleaned value. The parent page
 * owns the service calls (create vs update) — mirroring InstituteForm / ExamForm.
 * Remount it (via a React `key`) to reset the draft when switching edit targets.
 */
import React, { useRef, useState } from 'react';

import {
  type CategoryQuestionInput,
  type CategoryQuestionType,
  questionTypeHasOptions,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { ChevronDown, ChevronUp, Plus, Upload, X } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

/** A question row while editing; `key` is a stable React key (kept reorder-safe, not persisted). */
interface QuestionDraft {
  key: string;
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

  const [code, setCode] = useState(initialValue?.code ?? '');
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    (initialValue?.questions ?? []).map((q) => ({
      key: nextKey(),
      text: q.text,
      type: q.type,
      required: q.required ?? false,
      options: q.options ?? [],
    })),
  );

  const mutateQuestion = (i: number, patch: Partial<QuestionDraft>): void =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const addQuestion = (): void =>
    setQuestions((prev) => [
      ...prev,
      { key: nextKey(), text: '', type: 'text', required: false, options: [] },
    ]);

  const removeQuestion = (i: number): void =>
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));

  const setQuestionType = (i: number, type: CategoryQuestionType): void => {
    const current = questions[i];
    const needsOptions = questionTypeHasOptions(type);
    // Seed two blank options when switching to a choice type; clear otherwise.
    const options = needsOptions
      ? current && current.options.length > 0
        ? current.options
        : ['', '']
      : [];
    mutateQuestion(i, { type, options });
  };

  /** Swap a question with its neighbour (dir -1 = up, +1 = down). */
  const moveQuestion = (i: number, dir: -1 | 1): void =>
    setQuestions((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const a = next[i];
      const b = next[j];
      if (!a || !b) return prev;
      next[i] = b;
      next[j] = a;
      return next;
    });

  const addOption = (qi: number): void =>
    mutateQuestion(qi, { options: [...(questions[qi]?.options ?? []), ''] });
  const setOption = (qi: number, oi: number, value: string): void => {
    const options = (questions[qi]?.options ?? []).map((o, idx) => (idx === oi ? value : o));
    mutateQuestion(qi, { options });
  };
  const removeOption = (qi: number, oi: number): void => {
    const options = (questions[qi]?.options ?? []).filter((_, idx) => idx !== oi);
    mutateQuestion(qi, { options });
  };

  const errors = questions.map(questionError);
  const hasQuestionErrors = errors.some((e) => e !== null);
  const canSave = code.trim().length > 0 && name.trim().length > 0 && !hasQuestionErrors;

  const handleSave = (): void => {
    const cleaned: CategoryQuestionInput[] = questions
      .filter((q) => q.text.trim().length > 0)
      .map((q) => ({
        text: q.text.trim(),
        type: q.type,
        required: q.required,
        ...(questionTypeHasOptions(q.type)
          ? { options: q.options.map((o) => o.trim()).filter((o) => o.length > 0) }
          : {}),
      }));
    onSave({
      code: code.trim(),
      name: name.trim(),
      description: description.trim(),
      questions: cleaned,
    });
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="cat-code"
          name="code"
          label="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <FormField
          id="cat-name"
          name="name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FormField
          id="cat-description"
          name="description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required={false}
          containerClassName="sm:col-span-2"
        />
      </div>

      {/* Builder + live preview side by side on large screens */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Dynamic questions builder */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Registration Questions</h3>
              <p className="text-xs text-muted-foreground">
                Questions institutes answer when registering under this category.
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addQuestion}>
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
                        onClick={() => moveQuestion(i, -1)}
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Move question ${i + 1} down`}
                        disabled={i === questions.length - 1}
                        onClick={() => moveQuestion(i, 1)}
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove question ${i + 1}`}
                        onClick={() => removeQuestion(i)}
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

                  <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-[var(--brand)]"
                      checked={q.required}
                      onChange={(e) => mutateQuestion(i, { required: e.target.checked })}
                    />
                    Required — institute must answer this
                  </label>

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

                  {errors[i] && (
                    <p className="mt-2 text-xs font-medium text-danger-foreground">{errors[i]}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live preview — what the institute sees on the public form */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Preview</h3>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <p className="mb-4 text-xs text-muted-foreground">
              {name.trim() || 'Category'} — how the questions appear to an institute.
            </p>
            <QuestionsPreview questions={questions} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={!canSave} onClick={handleSave}>
          {mode === 'edit' ? 'Save Changes' : 'Add Category'}
        </Button>
      </div>
    </div>
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
