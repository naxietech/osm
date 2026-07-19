/**
 * Institute Categories (super admin) — the taxonomy that classifies institutes
 * (School, College, Board, University, Academy, PECTA). Each category can carry
 * dynamic questions that institutes answer when they register under it. Gated by
 * `institute-categories.manage`.
 *
 * Thin page: it owns the list + row actions + service calls, and delegates the whole
 * create/edit experience (fields + question builder + preview) to the
 * InstituteCategoryForm organism.
 */
import React, { useState } from 'react';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Trash2 } from '@/design-system/atoms/icon';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import {
  InstituteCategoryForm,
  type InstituteCategoryFormValue,
} from '@/design-system/organisms/institute-category-form';
import {
  createInstituteCategory,
  deleteInstituteCategory,
  instituteCategories,
  toggleInstituteCategoryActive,
  updateInstituteCategory,
} from '@/services/institute-category.service';
import { countInstitutesInCategory } from '@/services/institute.service';

interface CategoryRow {
  id: string;
  code: string;
  name: string;
  description: string;
  questionCount: number;
  isActive: boolean;
  instituteCount: number;
}

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
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);

  const rows: CategoryRow[] = instituteCategories.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description ?? '',
    questionCount: c.questions.length,
    isActive: c.isActive,
    instituteCount: countInstitutesInCategory(c.id),
  }));

  const editing = editingId ? instituteCategories.find((c) => c.id === editingId) : undefined;
  const initialValue: InstituteCategoryFormValue | undefined = editing
    ? {
        code: editing.code,
        name: editing.name,
        description: editing.description ?? '',
        questions: editing.questions.map((q) => ({
          text: q.text,
          type: q.type,
          required: q.required,
          options: q.options,
        })),
      }
    : undefined;

  const openCreate = (): void => {
    setEditingId(null);
    setIsOpen(true);
  };

  const openEdit = (id: string): void => {
    setEditingId(id);
    setIsOpen(true);
  };

  const close = (): void => {
    setIsOpen(false);
    setEditingId(null);
  };

  const handleSave = (value: InstituteCategoryFormValue): void => {
    if (editingId) {
      updateInstituteCategory(editingId, {
        code: value.code,
        name: value.name,
        description: value.description,
        questions: value.questions,
      });
    } else {
      createInstituteCategory({
        code: value.code,
        name: value.name,
        ...(value.description ? { description: value.description } : {}),
        questions: value.questions,
      });
    }
    refresh();
    close();
  };

  const handleToggle = (id: string): void => {
    toggleInstituteCategoryActive(id);
    refresh();
  };

  const handleDelete = (row: CategoryRow): void => {
    if (row.instituteCount > 0) return; // guarded — button is disabled in this case
    deleteInstituteCategory(row.id);
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
      key: 'instituteCount',
      header: 'Institutes',
      render: (r) =>
        r.instituteCount > 0 ? (
          `${r.instituteCount}`
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
          <Button
            variant="ghost"
            size="sm"
            disabled={r.instituteCount > 0}
            title={
              r.instituteCount > 0
                ? `Can't delete — ${r.instituteCount} institute(s) use this category`
                : 'Delete category'
            }
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r);
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
        <DataTable<CategoryRow> data={rows} columns={columns} emptyMessage="Nothing here yet" />
      </div>
    </>
  );
}

export default InstituteCategoriesPage;
