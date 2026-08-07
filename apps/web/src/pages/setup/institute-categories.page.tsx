/**
 * Institute Categories (super admin) — the taxonomy that classifies institutes, live against
 * the API. An Admin may open this screen with `institute-categories.view` and sees it read-only;
 * every control below is gated on `institute-categories.manage`.
 *
 * Thin page: it owns the list, the row actions and the service calls, and delegates the whole
 * create/edit experience to the InstituteCategoryForm organism.
 *
 * **Two things here are deliberate.**
 *
 * - **Deleting lives in the edit form, not the row.** A row of icons invites a mis-click, and
 *   delete is the one action here with no undo. Reaching it means opening the category first,
 *   which is also the only place you can see what you are about to destroy.
 * - **Not every 409 means "someone else saved first".** Three different conflicts share that
 *   status: the optimistic lock, a code already taken, and a question whose answers forbid the
 *   change. Only the first is fixed by reloading; telling an editor to reload for the other two
 *   sends them round a loop that changes nothing. The API sends a code for the one that is.
 */
import React, { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import type { InstituteCategory } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Badge } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { Ban, Pencil, Undo2 } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { ActiveBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import {
  InstituteCategoryForm,
  type InstituteCategoryFormValue,
} from '@/design-system/organisms/institute-category-form';
import { usePermissions } from '@/hooks';
import {
  INSTITUTE_CATEGORIES_KEY,
  useCreateCategory,
  useDeleteCategory,
  useInstituteCategories,
  useSetCategoryActive,
  useUpdateCategory,
} from '@/hooks/use-institute-categories';
import { ApiError, apiErrorMessage } from '@/services/api-client';

/**
 * The API's code for the optimistic-lock 409 — the only conflict on this screen that reloading
 * resolves. Matching on the message text instead would break the moment the API rephrased it.
 */
const VERSION_CONFLICT = 'CategoryVersionConflict';

/** Human labels for the question types, so the drawer never shows a raw enum value. */
const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: 'Text box',
  radio: 'Radio (choose one)',
  checkbox: 'Checkbox (choose many)',
  select: 'Dropdown',
  file: 'File upload',
};

interface CategoryRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  questions: InstituteCategory['questions'];
}

export function InstituteCategoriesPage(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [toggling, setToggling] = useState<CategoryRow | null>(null);

  /** Admin holds `institute-categories.view` only — they see the taxonomy, they do not edit it. */
  const { can } = usePermissions();
  const canManage = can('institute-categories.manage');

  const queryClient = useQueryClient();
  const categoriesQuery = useInstituteCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const setActive = useSetCategoryActive();
  const remove = useDeleteCategory();

  const categories: InstituteCategory[] = categoriesQuery.data ?? [];
  const editing = editingId ? categories.find((c) => c.id === editingId) : undefined;

  const rows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    isActive: c.isActive,
    questions: c.questions,
  }));

  const initialValue: InstituteCategoryFormValue | undefined = editing
    ? {
        code: editing.code,
        name: editing.name,
        description: editing.description ?? '',
        // The stored ids travel out and back. A question returning without one is read as new,
        // which would re-create the list and strand every answer already given against it.
        questions: editing.questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          required: q.required,
          options: q.options,
        })),
      }
    : undefined;

  const close = (): void => {
    setIsOpen(false);
    setEditingId(null);
  };

  const handleSave = (value: InstituteCategoryFormValue): void => {
    setError(null);
    setConflict(null);

    const done = (message: string) => (): void => {
      setBanner(message);
      close();
    };

    const failed = (err: unknown): void => {
      // Only the optimistic lock earns the reload advice. A duplicate code or an answered
      // question is the submission itself being refused, and the API's wording already says
      // what to change — repeating "reload and try again" over it would be false instruction.
      if (err instanceof ApiError && err.code === VERSION_CONFLICT) {
        setConflict(apiErrorMessage(err));
        // Refetch, or the advice below the banner is a lie: the cached row still holds the
        // version we just lost with, so reopening the form would resubmit it and conflict
        // again. This is the one place a failed mutation must still refresh the list.
        void queryClient.invalidateQueries({ queryKey: INSTITUTE_CATEGORIES_KEY });
        return;
      }
      setError(apiErrorMessage(err));
    };

    if (editingId && editing) {
      void update
        .mutateAsync({
          id: editingId,
          dto: {
            version: editing.version,
            code: value.code,
            name: value.name,
            // Empty means "clear it", which is `null` — not an empty string the API would store.
            description: value.description.trim() === '' ? null : value.description,
            questions: value.questions,
          },
        })
        .then(done('Category updated.'))
        .catch(failed);
      return;
    }

    void create
      .mutateAsync({
        code: value.code,
        name: value.name,
        ...(value.description ? { description: value.description } : {}),
        questions: value.questions,
      })
      .then(done('Category created.'))
      .catch(failed);
  };

  const handleToggle = (): void => {
    if (!toggling) return;
    const { id, name, isActive } = toggling;
    setError(null);
    void setActive
      .mutateAsync({ id, isActive: !isActive })
      .then(() => setBanner(`${name} ${isActive ? 'deactivated' : 'activated'}.`))
      .catch((err: unknown) => setError(apiErrorMessage(err)))
      .finally(() => setToggling(null));
  };

  const handleDelete = (): void => {
    if (!deleting) return;
    const name = deleting.name;
    setError(null);
    void remove
      .mutateAsync(deleting.id)
      .then(() => {
        setBanner(`${name} deleted.`);
        close();
      })
      // The API refuses while any institute is filed under it, and says so — including
      // soft-deleted institutes, whose rows still point here.
      .catch((err: unknown) => setError(apiErrorMessage(err)))
      .finally(() => setDeleting(null));
  };

  const columns: ColumnDef<CategoryRow>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (r) => <span className="font-mono text-sm text-muted-foreground">{r.code}</span>,
      width: '120px',
    },
    {
      key: 'name',
      header: 'Name',
      render: (r) => <span className="font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'questionCount',
      header: 'Questions',
      render: (r) =>
        r.questions.length > 0 ? (
          <Badge variant="info">{r.questions.length}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      width: '110px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <ActiveBadge active={r.isActive} />,
      width: '110px',
    },
    {
      key: 'actions',
      header: 'Actions',
      // Withheld entirely without the manage grant, rather than rendered disabled.
      render: (r) =>
        !canManage ? null : (
          <div className="flex justify-end gap-2">
            <IconButton
              size="sm"
              label={`Edit ${r.name}`}
              icon={<Pencil className="h-4 w-4" aria-hidden />}
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(r.id);
                setIsOpen(true);
              }}
            />
            <IconButton
              size="sm"
              tone={r.isActive ? 'danger' : 'default'}
              label={`${r.isActive ? 'Deactivate' : 'Reactivate'} ${r.name}`}
              icon={
                r.isActive ? (
                  <Ban className="h-4 w-4" aria-hidden />
                ) : (
                  <Undo2 className="h-4 w-4" aria-hidden />
                )
              }
              onClick={(e) => {
                e.stopPropagation();
                setToggling(r);
              }}
            />
          </div>
        ),
      width: '130px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Institute Categories"
        subtitle="Classify institutes and set the questions they answer at registration"
        actions={
          !isOpen &&
          canManage && (
            <Button
              variant="primary"
              onClick={() => {
                setEditingId(null);
                setIsOpen(true);
              }}
            >
              Add Category
            </Button>
          )
        }
      />

      {banner && (
        <Alert tone="success" className="mb-4" onDismiss={() => setBanner(null)}>
          {banner}
        </Alert>
      )}

      {conflict && (
        <Alert tone="warning" className="mb-4" onDismiss={() => setConflict(null)}>
          <span className="font-medium">Someone else saved first.</span> {conflict} Your changes
          have not been applied. Close the form and open it again to start from their version —
          reloading is the only safe move, because saving over them is exactly what this check
          exists to prevent.
        </Alert>
      )}

      {error && (
        <Alert
          tone="danger"
          className="mb-4"
          onDismiss={() => setError(null)}
          dismissLabel="Dismiss error"
        >
          {error}
        </Alert>
      )}

      {categoriesQuery.isError && (
        <Alert tone="danger" className="mb-4">
          {apiErrorMessage(categoriesQuery.error)}
        </Alert>
      )}

      {isOpen && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {editingId ? 'Edit Category' : 'Add Category'}
          </h2>
          <InstituteCategoryForm
            key={editingId ?? 'new'}
            mode={editingId ? 'edit' : 'create'}
            initialValue={initialValue}
            onSave={handleSave}
            onCancel={close}
            {...(editingId && editing
              ? {
                  onDelete: () => setDeleting(rows.find((r) => r.id === editingId) ?? null),
                }
              : {})}
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {categoriesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <DataTable<CategoryRow>
            data={rows}
            columns={columns}
            emptyMessage="Nothing here yet"
            expandLabel={(r) => `Show questions for ${r.name}`}
            renderExpanded={(r) =>
              r.questions.length === 0 ? null : <QuestionList questions={r.questions} />
            }
          />
        )}
      </div>

      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={handleToggle}
        title={
          toggling?.isActive
            ? `Deactivate ${toggling.name}?`
            : `Reactivate ${toggling?.name ?? ''}?`
        }
        description={
          toggling?.isActive
            ? 'The category disappears from the public registration form, so no institute can choose it from now on. Institutes already filed under it keep it, and their stored answers are untouched. This can be reversed.'
            : 'The category goes back on the public registration form and institutes can choose it again. Its questions return exactly as they were — nothing was lost while it was off.'
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Reactivate'}
        tone={toggling?.isActive ? 'danger' : 'primary'}
        busy={setActive.isPending}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="This removes the category and its questions outright, and cannot be undone. It is refused while any institute is filed under it — deactivate it instead to close it to new registrations."
        confirmLabel="Delete category"
        tone="danger"
        busy={remove.isPending}
      />
    </>
  );
}

/** The questions a category asks, shown in the row drawer. Read-only — editing is in the form. */
function QuestionList({
  questions,
}: {
  questions: InstituteCategory['questions'];
}): React.ReactElement {
  return (
    <table className="min-w-full">
      <thead>
        <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <th className="pb-2 pr-4">Question</th>
          <th className="pb-2 pr-4" style={{ width: '180px' }}>
            Type
          </th>
          <th className="pb-2 pr-4" style={{ width: '110px' }}>
            Required
          </th>
          <th className="pb-2">Options</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {questions.map((q) => (
          <tr key={q.id} className="align-top text-sm">
            <td className="py-2 pr-4 text-foreground">{q.text}</td>
            <td className="py-2 pr-4 text-muted-foreground">
              {QUESTION_TYPE_LABELS[q.type] ?? q.type}
            </td>
            <td className="py-2 pr-4">
              {q.required ? (
                <Badge variant="warning">Required</Badge>
              ) : (
                <span className="text-muted-foreground">Optional</span>
              )}
            </td>
            <td className="py-2">
              {q.options.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {q.options.map((option) => (
                    <Badge key={option}>{option}</Badge>
                  ))}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default InstituteCategoriesPage;
