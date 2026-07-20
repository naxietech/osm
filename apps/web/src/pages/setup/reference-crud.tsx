/**
 * ReferenceCrud — a reusable super-admin management screen for simple reference data
 * (Subjects, and any future flat reference list). Renders a list with an add/edit form
 * panel and an activate/deactivate toggle per row. Each consumer maps its typed records
 * to RefItem and supplies create/update/toggle handlers backed by a mock service.
 *
 * Optional, opt-in features (absent → original behaviour):
 *  - `uniqueKeys`  : field keys whose value must be unique across rows (e.g. code).
 *  - `searchable`  : shows a search box that filters rows across all field values.
 *  - `usage`       : adds a usage-count column and warns before deactivating a row in use.
 *
 * Kept intentionally small: text/number fields only, one active flag. Richer reference
 * data (e.g. the Curriculum mapping) gets its own bespoke screen.
 */
import React, { useState } from 'react';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';
import { ActiveBadge } from '@/design-system/molecules/status-badge';
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

/** A usage-count column + deactivation guard (e.g. how many exams use this subject). */
export interface RefUsage {
  header: string;
  get: (item: RefItem) => number;
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
  /** Field keys whose value must be unique across rows (case-insensitive). */
  uniqueKeys?: string[];
  /** Show a search box that filters rows across all field values. */
  searchable?: boolean;
  /** Adds a usage column and guards deactivation of a row that's in use. */
  usage?: RefUsage;
}

function emptyValues(fields: RefField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, '']));
}

function itemLabel(item: RefItem): string {
  return String(item.name ?? item.code ?? item.id);
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
  uniqueKeys,
  searchable = false,
  usage,
}: ReferenceCrudProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => emptyValues(fields));
  const [query, setQuery] = useState('');
  const [pendingToggle, setPendingToggle] = useState<RefItem | null>(null);
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);
  const items = getItems();

  const requestToggle = (item: RefItem): void => {
    const inUse = item.isActive && usage ? usage.get(item) > 0 : false;
    if (inUse) {
      setPendingToggle(item);
    } else {
      onToggleActive(item);
      refresh();
    }
  };
  const confirmToggle = (): void => {
    if (pendingToggle) onToggleActive(pendingToggle);
    setPendingToggle(null);
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

  /** Duplicate error for a unique field (empty string = no error). */
  const fieldError = (key: string): string => {
    if (!uniqueKeys?.includes(key)) return '';
    const value = values[key]?.trim().toLowerCase() ?? '';
    if (!value) return '';
    const label = fields.find((f) => f.key === key)?.label ?? key;
    const clash = items.some(
      (it) =>
        it.id !== editingId &&
        String(it[key] ?? '')
          .trim()
          .toLowerCase() === value,
    );
    return clash ? `This ${label.toLowerCase()} is already used.` : '';
  };

  const hasDuplicate = (uniqueKeys ?? []).some((k) => fieldError(k) !== '');
  const canSave =
    fields.every((f) => f.required === false || (values[f.key]?.trim().length ?? 0) > 0) &&
    !hasDuplicate;

  const save = (): void => {
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    if (editingId) onUpdate(editingId, trimmed);
    else onCreate(trimmed);
    refresh();
    close();
  };

  const q = query.trim().toLowerCase();
  const visibleItems =
    searchable && q
      ? items.filter((it) =>
          fields.some((f) =>
            String(it[f.key] ?? '')
              .toLowerCase()
              .includes(q),
          ),
        )
      : items;

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
    ...(usage
      ? [
          {
            key: 'usage',
            header: usage.header,
            render: (row: RefItem) => {
              const count = usage.get(row);
              return count > 0 ? `${count}` : <span className="text-muted-foreground">—</span>;
            },
            width: '120px',
          } satisfies ColumnDef<RefItem>,
        ]
      : []),
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
              requestToggle(row);
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

      {pendingToggle && usage && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3">
          <p className="text-sm text-warning-foreground">
            <span className="font-medium">{itemLabel(pendingToggle)}</span> is used by{' '}
            {usage.get(pendingToggle)} {usage.header.toLowerCase()}. Deactivate anyway?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingToggle(null)}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={confirmToggle}>
              Deactivate
            </Button>
          </div>
        </div>
      )}

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
                error={fieldError(f.key)}
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

      {searchable && items.length > 0 && (
        <div className="mb-4 max-w-xs">
          <Input
            type="search"
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder={`Search ${title.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<RefItem> data={visibleItems} columns={columns} emptyMessage="Nothing here yet" />
      </div>
    </>
  );
}

export default ReferenceCrud;
