/**
 * Classes (super admin) — the Class → Group → Subgroup hierarchy (TRD), live against the API.
 *
 * Groups have no separate module; they're authored inline on the class via the
 * ClassHierarchyForm organism, and the class plus its whole tree save in **one** request, so a
 * Save either fully happens or fully doesn't. Gated by `levels.manage`.
 *
 * Thin page: it owns the list, the row actions and the service calls; the form experience
 * lives in the organism.
 */
import React, { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { AcademicClass, ClassGroupInput } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Ban, Check, Pencil } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { Alert } from '@/design-system/molecules/alert';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { ActiveBadge } from '@/design-system/molecules/status-badge';
import {
  ClassHierarchyForm,
  type ClassHierarchyValue,
} from '@/design-system/organisms/class-hierarchy-form';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { CLASSES_KEY, useClasses } from '@/hooks/use-classes';
import { apiErrorMessage } from '@/services/api-client';
import { classesService } from '@/services/classes.service';

/** The organism's value, translated into what the API expects. */
function toGroupInputs(groups: ClassHierarchyValue['groups']): ClassGroupInput[] {
  return groups.map((group) => ({
    ...(group.id ? { id: group.id } : {}),
    name: group.name,
    subgroups: group.subgroups.map((subgroup) => ({
      ...(subgroup.id ? { id: subgroup.id } : {}),
      name: subgroup.name,
    })),
  }));
}

/**
 * The group/subgroup tree, read-only, shown when a row is expanded.
 *
 * Page-specific composition rather than a new design-system component: it is a nested list of
 * names and exists nowhere else. If a second screen ever needs it, that is the moment to
 * extract it into a molecule.
 */
function ClassTree({ cls }: { cls: AcademicClass }): React.ReactElement {
  return (
    <ul className="space-y-2">
      {cls.groups.map((group) => (
        <li key={group.id}>
          <span className="text-sm font-medium text-foreground">{group.name}</span>
          {group.subgroups.length > 0 && (
            <ul className="mt-1 space-y-1 border-l border-border pl-4">
              {group.subgroups.map((subgroup) => (
                <li key={subgroup.id} className="text-sm text-muted-foreground">
                  {subgroup.name}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A stored class, translated into what the organism draws. */
function toFormValue(cls: AcademicClass): ClassHierarchyValue {
  return {
    name: cls.name,
    ordinal: String(cls.ordinal),
    description: cls.description ?? '',
    groups: cls.groups.map((group) => ({
      id: group.id,
      name: group.name,
      subgroups: group.subgroups.map((subgroup) => ({ id: subgroup.id, name: subgroup.name })),
    })),
  };
}

export function ClassesPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const { classes, isLoading, isError, error } = useClasses();

  const [isOpen, setIsOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<AcademicClass | null>(null);
  /** Which classes have their group tree open. Collapsed is the default — the list is a list. */
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

  /**
   * Which rows have a status change in flight. Every row shares one mutation, and React
   * Query's `variables` only ever describe the most recent call — reading that would move the
   * spinner off the first row the moment a second is clicked, while its request is still
   * running. Tracking ids ourselves keeps each row honest.
   */
  const [busyRowIds, setBusyRowIds] = useState<ReadonlySet<string>>(new Set());

  const setRowBusy = (id: string, busy: boolean): void =>
    setBusyRowIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * The class being edited, **frozen when the form opened** — deliberately a copy rather than
   * a lookup into the live query.
   *
   * The version sent on save has to be the one the draft was built from. Reading it from the
   * query at submit time instead would take whatever the cache holds by then: any mutation
   * invalidates the list, so a refetch between opening the form and saving would hand the
   * server a *newer* version alongside the *older* field values. The optimistic-lock check
   * would pass and this save would silently overwrite the change it should have conflicted
   * with — the exact loss `version` exists to prevent.
   *
   * Holding our own copy also means the form can never lose its subject mid-edit and quietly
   * turn into an "Add Class" that duplicates the row it was meant to update.
   */
  const [editing, setEditing] = useState<AcademicClass | null>(null);

  const refreshList = (): Promise<void> => queryClient.invalidateQueries({ queryKey: CLASSES_KEY });

  const toggleExpanded = (cls: AcademicClass): void =>
    setExpandedIds((open) => {
      const next = new Set(open);
      if (!next.delete(cls.id)) next.add(cls.id);
      return next;
    });

  /** Page-level banners are mutually exclusive with whatever the next action reports. */
  const clearBanners = (): void => {
    setNotice(null);
    setActionError(null);
  };

  const close = (): void => {
    setIsOpen(false);
    setEditing(null);
    setSaveError(null);
  };

  const openCreate = (): void => {
    clearBanners();
    setSaveError(null);
    setEditing(null);
    setIsOpen(true);
  };

  const openEdit = (cls: AcademicClass): void => {
    clearBanners();
    setSaveError(null);
    setEditing(cls);
    setIsOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (value: ClassHierarchyValue) => {
      const groups = toGroupInputs(value.groups);
      const ordinal = Number(value.ordinal);

      if (editing) {
        return classesService.updateClass(editing.id, {
          version: editing.version,
          name: value.name,
          ordinal,
          // Null rather than an empty string, so clearing the box clears the column.
          description: value.description || null,
          groups,
        });
      }
      return classesService.createClass({
        name: value.name,
        ordinal,
        ...(value.description ? { description: value.description } : {}),
        groups,
      });
    },
    onSuccess: async (saved) => {
      setSaveError(null);
      setNotice(editing ? `${saved.name} saved.` : `${saved.name} added.`);
      close();
      // Without this the new class does not appear until the cache goes stale.
      await refreshList();
    },
    // The server writes for users — a duplicate name, a stale version — so its wording is
    // shown as-is rather than restated here, where it would drift from the API's rules.
    onError: (err: unknown) => {
      setNotice(null);
      setSaveError(apiErrorMessage(err));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      classesService.setStatus(id, isActive),
    onMutate: ({ id }) => setRowBusy(id, true),
    onSettled: (_result, _error, { id }) => setRowBusy(id, false),
    onSuccess: async (saved) => {
      setActionError(null);
      setNotice(saved.isActive ? `${saved.name} activated.` : `${saved.name} deactivated.`);
      setPendingDeactivate(null);
      await refreshList();
    },
    onError: (err: unknown) => {
      setNotice(null);
      setActionError(apiErrorMessage(err));
      setPendingDeactivate(null);
    },
  });

  /** Deactivating is the direction worth pausing on; activating needs no confirmation. */
  const requestStatusChange = (cls: AcademicClass): void => {
    clearBanners();
    if (!cls.isActive) {
      statusMutation.mutate({ id: cls.id, isActive: true });
      return;
    }
    setPendingDeactivate(cls);
  };

  const columns: ColumnDef<AcademicClass>[] = [
    {
      key: 'name',
      header: 'Class',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: 'ordinal', header: 'Order', render: (row) => row.ordinal, width: '90px' },
    {
      key: 'description',
      header: 'Description',
      render: (row) =>
        row.description ? row.description : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'groups',
      header: 'Groups',
      render: (row) =>
        row.groups.length > 0 ? (
          `${row.groups.length}`
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      width: '100px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ActiveBadge active={row.isActive} />,
      width: '110px',
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '110px',
      /**
       * Icon buttons, not word buttons — the row is a click target for expanding now, and two
       * labelled buttons per row took more width than the class name they belonged to. Each
       * carries its words in `label`, which is both the tooltip and what a screen reader
       * announces, so nothing is lost by dropping the visible text.
       *
       * `stopPropagation` on both: without it, acting on a row would also toggle its tree.
       */
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <IconButton
            icon={<Pencil size={15} aria-hidden />}
            label="Edit class"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
          />
          {row.isActive ? (
            <IconButton
              icon={<Ban size={15} aria-hidden />}
              label="Deactivate class"
              tone="danger"
              size="sm"
              isLoading={busyRowIds.has(row.id)}
              onClick={(e) => {
                e.stopPropagation();
                requestStatusChange(row);
              }}
            />
          ) : (
            <IconButton
              icon={<Check size={15} aria-hidden />}
              label="Activate class"
              size="sm"
              isLoading={busyRowIds.has(row.id)}
              onClick={(e) => {
                e.stopPropagation();
                requestStatusChange(row);
              }}
            />
          )}
        </div>
      ),
    },
  ];

  const listError = isError ? apiErrorMessage(error) : null;

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

      {(listError ?? actionError) && (
        <Alert tone="danger" className="mb-4">
          {listError ?? actionError}
        </Alert>
      )}

      {notice && !listError && !actionError && (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      )}

      {isOpen && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {editing ? 'Edit Class' : 'Add Class'}
          </h2>
          {/*
            An inline card, not a Modal: this form grows a row per group and a row per
            subgroup, and on a phone a modal would fight it for height as soon as a class has
            four groups. `key` remounts it when the target changes, so the draft never carries
            over from one class to another.
          */}
          <ClassHierarchyForm
            key={editing?.id ?? 'new'}
            mode={editing ? 'edit' : 'create'}
            {...(editing ? { initialValue: toFormValue(editing) } : {})}
            onSave={(value) => saveMutation.mutate(value)}
            onCancel={close}
            submitting={saveMutation.isPending}
            error={saveError}
          />
        </div>
      )}

      {/*
        A list that failed to load is not an empty list. Rendering the table anyway puts
        "No classes yet" directly beneath the error banner, and an admin who reads the table
        rather than the banner adds a class that already exists. Cached rows still show if we
        have any — only the contradictory empty state is withheld.
      */}
      {!(listError && classes.length === 0) && (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          {/*
            Clicking a row opens its tree rather than the editor. Editing is the Edit button —
            a row that both reveals and edits on one click is a row people open by accident.
            A class with no groups has nothing to reveal, so it returns null and stays inert.
          */}
          <DataTable<AcademicClass>
            data={classes}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No classes yet"
            renderExpanded={(row) => (row.groups.length > 0 ? <ClassTree cls={row} /> : null)}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpanded}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={() =>
          pendingDeactivate && statusMutation.mutate({ id: pendingDeactivate.id, isActive: false })
        }
        title={`Deactivate ${pendingDeactivate?.name ?? 'this class'}?`}
        description="It stops being offered for new students and exams. Nothing already recorded against it is affected, and you can activate it again at any time."
        confirmLabel="Deactivate"
        tone="danger"
        busy={statusMutation.isPending}
      />
    </>
  );
}

export default ClassesPage;
