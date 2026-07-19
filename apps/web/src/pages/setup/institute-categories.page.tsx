/**
 * Institute Categories (super admin) — the taxonomy that classifies institutes
 * (School, College, Board, University, Academy, PECTA). Each category can carry
 * dynamic yes/no questions that institutes answer when they register under it
 * (e.g. "Are you ed-tech?"). Gated by `institute-categories.manage`.
 *
 * Bespoke screen (not ReferenceCrud) because of the question builder.
 */
import React, { useState } from 'react';

import { type CategoryQuestionType, questionTypeHasOptions } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Plus, X } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import {
  createInstituteCategory,
  instituteCategories,
  toggleInstituteCategoryActive,
  updateInstituteCategory,
} from '@/services/institute-category.service';

interface QuestionDraft {
  text: string;
  type: CategoryQuestionType;
  options: string[];
}

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'text', label: 'Text box' },
  { value: 'radio', label: 'Radio (choose one)' },
  { value: 'checkbox', label: 'Checkbox (choose many)' },
  { value: 'select', label: 'Dropdown' },
];

interface CategoryRow {
  id: string;
  code: string;
  name: string;
  description: string;
  questionCount: number;
  isActive: boolean;
}

interface FormState {
  code: string;
  name: string;
  description: string;
  questions: QuestionDraft[];
}

const EMPTY_FORM: FormState = { code: '', name: '', description: '', questions: [] };

function ActiveBadge({ active }: { active: boolean }): React.ReactElement {
  return active ? (
    <span className="rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success-foreground">
      Active
    </span>
  ) : (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      Inactive
    </span>
  );
}

export function InstituteCategoriesPage(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);

  const rows: CategoryRow[] = instituteCategories.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description ?? '',
    questionCount: c.questions.length,
    isActive: c.isActive,
  }));

  const openCreate = (): void => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  };

  const openEdit = (id: string): void => {
    const c = instituteCategories.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    setForm({
      code: c.code,
      name: c.name,
      description: c.description ?? '',
      questions: c.questions.map((q) => ({ text: q.text, type: q.type, options: [...q.options] })),
    });
    setIsOpen(true);
  };

  const close = (): void => {
    setIsOpen(false);
    setEditingId(null);
  };

  const setField = (key: keyof Omit<FormState, 'questions'>, value: string): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutateQuestion = (i: number, patch: Partial<QuestionDraft>): void =>
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)),
    }));

  const addQuestion = (): void =>
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, { text: '', type: 'text', options: [] }],
    }));
  const setQuestionText = (i: number, value: string): void => mutateQuestion(i, { text: value });
  const setQuestionType = (i: number, type: CategoryQuestionType): void => {
    const current = form.questions[i];
    const needsOptions = questionTypeHasOptions(type);
    // Seed two blank options when switching a text question to a choice type; clear when switching back to text.
    const options = needsOptions
      ? current && current.options.length > 0
        ? current.options
        : ['', '']
      : [];
    mutateQuestion(i, { type, options });
  };
  const removeQuestion = (i: number): void =>
    setForm((prev) => ({ ...prev, questions: prev.questions.filter((_, idx) => idx !== i) }));

  const addOption = (qi: number): void =>
    mutateQuestion(qi, { options: [...(form.questions[qi]?.options ?? []), ''] });
  const setOption = (qi: number, oi: number, value: string): void => {
    const options = (form.questions[qi]?.options ?? []).map((o, idx) => (idx === oi ? value : o));
    mutateQuestion(qi, { options });
  };
  const removeOption = (qi: number, oi: number): void => {
    const options = (form.questions[qi]?.options ?? []).filter((_, idx) => idx !== oi);
    mutateQuestion(qi, { options });
  };

  const canSave = form.code.trim().length > 0 && form.name.trim().length > 0;

  const save = (): void => {
    const questions = form.questions
      .filter((q) => q.text.trim().length > 0)
      .map((q) => ({
        text: q.text.trim(),
        type: q.type,
        ...(questionTypeHasOptions(q.type)
          ? { options: q.options.map((o) => o.trim()).filter((o) => o.length > 0) }
          : {}),
      }));
    if (editingId) {
      updateInstituteCategory(editingId, {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        questions,
      });
    } else {
      createInstituteCategory({
        code: form.code.trim(),
        name: form.name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        questions,
      });
    }
    refresh();
    close();
  };

  const handleToggle = (id: string): void => {
    toggleInstituteCategoryActive(id);
    refresh();
  };

  const columns: ColumnDef<CategoryRow>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (r) => <span className="font-mono text-sm">{r.code}</span>,
    },
    { key: 'name', header: 'Name', render: (r) => r.name },
    {
      key: 'questionCount',
      header: 'Questions',
      render: (r) =>
        r.questionCount > 0 ? (
          `${r.questionCount}`
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      width: '110px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <ActiveBadge active={r.isActive} />,
      width: '120px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r.id);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(r.id);
            }}
          >
            {r.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
      width: '180px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Institute Categories"
        subtitle="Classify institutes and set the questions they answer at registration"
        actions={
          !isOpen && (
            <Button variant="primary" onClick={openCreate}>
              Add Category
            </Button>
          )
        }
      />

      {isOpen && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {editingId ? 'Edit Category' : 'Add Category'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="cat-code"
              name="code"
              label="Code"
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
              required
            />
            <FormField
              id="cat-name"
              name="name"
              label="Name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
            />
            <FormField
              id="cat-description"
              name="description"
              label="Description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              required={false}
              containerClassName="sm:col-span-2"
            />
          </div>

          {/* Dynamic yes/no questions */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Registration Questions</h3>
                <p className="text-xs text-muted-foreground">
                  Yes/No questions institutes answer when registering under this category.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={addQuestion}>
                <Plus className="h-4 w-4" aria-hidden />
                Add Question
              </Button>
            </div>

            {form.questions.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No questions yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {form.questions.map((q, i) => (
                  <li key={i} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Question {i + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove question ${i + 1}`}
                        onClick={() => removeQuestion(i)}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        aria-label={`Question ${i + 1} text`}
                        value={q.text}
                        onChange={(e) => setQuestionText(i, e.target.value)}
                        placeholder="e.g. Are you an ed-tech institute?"
                      />
                      <SelectField
                        label="Answer type"
                        options={TYPE_OPTIONS}
                        value={q.type}
                        onChange={(v) => setQuestionType(i, v as CategoryQuestionType)}
                      />
                    </div>

                    {/* Answer options for choice types */}
                    {questionTypeHasOptions(q.type) && (
                      <div className="mt-3 pl-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Answer options
                        </p>
                        <ul className="space-y-2">
                          {q.options.map((opt, oi) => (
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
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={save}>
              {editingId ? 'Save Changes' : 'Add Category'}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<CategoryRow> data={rows} columns={columns} emptyMessage="Nothing here yet" />
      </div>
    </>
  );
}

export default InstituteCategoriesPage;
