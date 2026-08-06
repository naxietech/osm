/**
 * Institute Categories (super admin) — the taxonomy that classifies institutes, live against
 * the API. Gated by `institute-categories.manage`.
 *
 * Thin page: it owns the list, the row actions and the service calls, and delegates the whole
 * create/edit experience to the InstituteCategoryForm organism.
 *
 * **The conflict path is the part worth reading.** Every update carries the `version` this screen
 * loaded, and the API applies it only while that still matches. If someone else saved first the
 * answer is a 409, and the honest response is to say so and reload — never to retry, which would
 * overwrite the very edit the check exists to protect.
 */
import React, { useState } from 'react';

import type { InstituteCategory } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Trash2 } from '@/design-system/atoms/icon';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { ActiveBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import {
  InstituteCategoryForm,
  type InstituteCategoryFormValue,
} from '@/design-system/organisms/institute-category-form';
import {
  useCreateCategory,
  useDeleteCategory,
  useInstituteCategories,
  useSetCategoryActive,
  useUpdateCategory,
} from '@/hooks/use-institute-categories';
import { ApiError, apiErrorMessage } from '@/services/api-client';

interface CategoryRow {
  id: string;
  code: string;
  name: string;
  questionCount: number;
  isActive: boolean;
}

export function InstituteCategoriesPage(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

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
    questionCount: c.questions.length,
    isActive: c.isActive,
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
      // A 409 on an update is the optimistic lock; on a create it is a duplicate code. Only the
      // first needs the reload advice, and the API's own wording carries the detail either way.
      if (editingId && err instanceof ApiError && err.status === 409) {
        setConflict(apiErrorMessage(err));
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

  const handleToggle = (row: CategoryRow): void => {
    setError(null);
    void setActive
      .mutateAsync({ id: row.id, isActive: !row.isActive })
      .then(() => setBanner(`${row.name} ${row.isActive ? 'deactivated' : 'activated'}.`))
      .catch((err: unknown) => setError(apiErrorMessage(err)));
  };

  const handleDelete = (): void => {
    if (!deleting) return;
    const name = deleting.name;
    setError(null);
    void remove
      .mutateAsync(deleting.id)
      .then(() => setBanner(`${name} deleted.`))
      // The API refuses while any institute is filed under it, and says so — including
      // soft-deleted institutes, whose rows still point here.
      .catch((err: unknown) => setError(apiErrorMessage(err)))
      .finally(() => setDeleting(null));
  };

  const columns: ColumnDef<CategoryRow>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (r) => <span className="font-mono text-sm">{r.code}</span>,
      width: '120px',
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
      width: '110px',
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
              setEditingId(r.id);
              setIsOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(r);
            }}
          >
            {r.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Delete category"
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(r);
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ),
      width: '230px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Institute Categories"
        subtitle="Classify institutes and set the questions they answer at registration"
        actions={
          !isOpen && (
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
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {categoriesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <DataTable<CategoryRow> data={rows} columns={columns} emptyMessage="Nothing here yet" />
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="This removes the category and its questions outright. It is refused while any institute is filed under it — deactivate it instead to close it to new registrations."
        confirmLabel="Delete category"
        tone="danger"
        busy={remove.isPending}
      />
    </>
  );
}

export default InstituteCategoriesPage;
