/**
 * ReferenceCrud — a reusable super-admin management screen for simple reference data
 * (Subjects, Classes/Levels, Groups, Institute Categories). Renders a list with an
 * add/edit form panel and an activate/deactivate toggle per row. Each consumer maps its
 * typed records to RefItem and supplies create/update/toggle handlers backed by a mock
 * service.
 *
 * Kept intentionally small: text/number fields only, one active flag. Richer reference
 * data (e.g. the Curriculum mapping) gets its own bespoke screen.
 */
import React, { useState } from 'react';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';

export interface RefField {
  key: string;
  label: string;
  type?: 'text' | 'number';
  required?: boolean;
}

export interface RefItem {
  id: string;
  isActive: boolean;
  [key: string]: unknown;
}

export interface ReferenceCrudProps {
  title: string;
  subtitle: string;
  addLabel: string;
  /** Read the current rows from the store (re-read after every mutation). */
  getItems: () => RefItem[];
  fields: RefField[];
  onCreate: (values: Record<string, string>) => void;
  onUpdate: (id: string, values: Record<string, string>) => void;
  onToggleActive: (item: RefItem) => void;
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

function emptyValues(fields: RefField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, '']));
}

export function ReferenceCrud({
  title,
  subtitle,
  addLabel,
  getItems,
  fields,
  onCreate,
  onUpdate,
  onToggleActive,
}: ReferenceCrudProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => emptyValues(fields));
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);
  const items = getItems();

  const handleToggle = (item: RefItem): void => {
    onToggleActive(item);
    refresh();
  };

  const openCreate = (): void => {
    setEditingId(null);
    setValues(emptyValues(fields));
    setIsOpen(true);
  };

  const openEdit = (item: RefItem): void => {
    setEditingId(item.id);
    setValues(
      Object.fromEntries(
        fields.map((f) => [f.key, item[f.key] == null ? '' : String(item[f.key])]),
      ),
    );
    setIsOpen(true);
  };

  const close = (): void => {
    setIsOpen(false);
    setEditingId(null);
  };

  const canSave = fields.every(
    (f) => f.required === false || (values[f.key]?.trim().length ?? 0) > 0,
  );

  const save = (): void => {
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    if (editingId) onUpdate(editingId, trimmed);
    else onCreate(trimmed);
    refresh();
    close();
  };

  const columns: ColumnDef<RefItem>[] = [
    ...fields.map<ColumnDef<RefItem>>((f) => ({
      key: f.key,
      header: f.label,
      render: (row) => {
        const value = row[f.key];
        return value == null || value === '' ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={f.key === 'code' ? 'font-mono text-sm' : undefined}>
            {String(value)}
          </span>
        );
      },
    })),
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ActiveBadge active={row.isActive} />,
      width: '120px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(row);
            }}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
      width: '180px',
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          !isOpen && (
            <Button variant="primary" onClick={openCreate}>
              {addLabel}
            </Button>
          )
        }
      />

      {isOpen && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {editingId ? 'Edit' : addLabel}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <FormField
                key={f.key}
                id={f.key}
                name={f.key}
                type={f.type === 'number' ? 'number' : 'text'}
                label={f.label}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                required={f.required !== false}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={save}>
              {editingId ? 'Save Changes' : addLabel}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<RefItem> data={items} columns={columns} emptyMessage="Nothing here yet" />
      </div>
    </>
  );
}

export default ReferenceCrud;
