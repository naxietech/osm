/**
 * Classes (super admin) — the Class → Group → Subgroup hierarchy (TRD). Groups have no
 * separate module; they're authored inline on the class via the ClassHierarchyForm
 * organism. This is the source of truth student registration and exam creation read.
 * Gated by `levels.manage`.
 *
 * Thin page: owns the list + row actions + service calls (including a usage-aware
 * deactivate guard); the form experience lives in the organism.
 */
import React, { useState } from 'react';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import {
  ClassHierarchyForm,
  type ClassHierarchyValue,
} from '@/design-system/organisms/class-hierarchy-form';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import {
  classGroupsFor,
  createLevel,
  levels,
  replaceClassGroups,
  toggleLevelActive,
  updateLevel,
} from '@/services/academic.service';
import { exams, students } from '@/services/mock-store';

interface ClassRow {
  id: string;
  name: string;
  description: string;
  groupCount: number;
  usage: number;
  isActive: boolean;
}

/** How many students + exams reference a class (guards deactivation). */
function classUsage(levelId: string): number {
  const inStudents = students.filter((s) => s.levelId === levelId).length;
  const inExams = exams.filter((e) => e.levelId === levelId).length;
  return inStudents + inExams;
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

export function ClassesPage(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<ClassRow | null>(null);
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);

  const rows: ClassRow[] = levels
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description ?? '',
      groupCount: (l.classGroups ?? []).length,
      usage: classUsage(l.id),
      isActive: l.isActive,
    }));

  const editing = editingId ? levels.find((l) => l.id === editingId) : undefined;
  const initialValue: ClassHierarchyValue | undefined = editing
    ? {
        name: editing.name,
        ordinal: String(editing.ordinal),
        description: editing.description ?? '',
        groups: classGroupsFor(editing.id).map((g) => ({
          id: g.id,
          name: g.name,
          subgroups: g.subgroups.map((s) => ({ id: s.id, name: s.name })),
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

  const handleSave = (value: ClassHierarchyValue): void => {
    const ordinalNum = Number(value.ordinal || '0');
    if (editingId) {
      updateLevel(editingId, {
        name: value.name,
        ordinal: ordinalNum,
        description: value.description,
      });
      replaceClassGroups(editingId, value.groups);
    } else {
      const created = createLevel({
        name: value.name,
        ordinal: ordinalNum,
        ...(value.description ? { description: value.description } : {}),
      });
      replaceClassGroups(created.id, value.groups);
    }
    refresh();
    close();
  };

  const requestToggle = (row: ClassRow): void => {
    if (row.isActive && row.usage > 0) {
      setPendingToggle(row);
    } else {
      toggleLevelActive(row.id);
      refresh();
    }
  };
  const confirmToggle = (): void => {
    if (pendingToggle) toggleLevelActive(pendingToggle.id);
    setPendingToggle(null);
    refresh();
  };

  const columns: ColumnDef<ClassRow>[] = [
    { key: 'name', header: 'Class', render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'description',
      header: 'Description',
      render: (r) =>
        r.description ? r.description : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'groupCount',
      header: 'Groups',
      render: (r) =>
        r.groupCount > 0 ? `${r.groupCount}` : <span className="text-muted-foreground">—</span>,
      width: '100px',
    },
    {
      key: 'usage',
      header: 'In use by',
      render: (r) =>
        r.usage > 0 ? `${r.usage}` : <span className="text-muted-foreground">—</span>,
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
              requestToggle(r);
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
        title="Classes"
        subtitle="Add a class, then its groups and subgroups"
        actions={
          !isOpen && (
            <Button variant="primary" onClick={openCreate}>
              Add Class
            </Button>
          )
        }
      />

      {pendingToggle && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3">
          <p className="text-sm text-warning-foreground">
            <span className="font-medium">{pendingToggle.name}</span> is used by{' '}
            {pendingToggle.usage} student(s) / exam(s). Deactivate anyway?
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
            {editingId ? 'Edit Class' : 'Add Class'}
          </h2>
          <ClassHierarchyForm
            key={editingId ?? 'new'}
            mode={editingId ? 'edit' : 'create'}
            initialValue={initialValue}
            onSave={handleSave}
            onCancel={close}
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<ClassRow>
          data={rows}
          columns={columns}
          onRowClick={(r) => openEdit(r.id)}
          emptyMessage="No classes yet"
        />
      </div>
    </>
  );
}

export default ClassesPage;
