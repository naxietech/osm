/**
 * Subjects (super admin) — the national subject/course list the curriculum, SLOs and exam
 * papers draw from. Live against `GET/POST/PATCH /subjects`, gated by `subjects.manage`.
 *
 * Deactivated subjects stay on the list on purpose: this is the only screen that can bring
 * one back, so hiding them here would make them unrecoverable. There is no delete — the API
 * has no delete route, and deactivating is the withdrawal path.
 *
 * Error wording comes from the server through `apiErrorMessage()`. The duplicate-code rule in
 * particular is the API's to phrase; restating it here is how the two copies drift apart.
 */
import React, { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Subject } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Ban, Check, Pencil } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { Input } from '@/design-system/atoms/input';
import { Alert } from '@/design-system/molecules/alert';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { ActiveBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { SubjectForm, type SubjectFormValue } from '@/design-system/organisms/subject-form';
import { SUBJECTS_KEY, useSubjects } from '@/hooks/use-subjects';
import { apiErrorMessage } from '@/services/api-client';
import { subjectsService } from '@/services/subjects.service';

export function SubjectsPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const { subjects, isLoading, isError, error } = useSubjects();

  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** The subject a dialog is open for, and which dialog. Null when none is open. */
  const [editing, setEditing] = useState<Subject | 'new' | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<Subject | null>(null);

  /**
   * Which rows have a status change in flight. Every row shares one mutation, and React
   * Query's `variables` only ever describe the most recent call — so reading it would make the
   * first row's button settle the moment a second row is clicked, while its request is still
   * running. Tracking ids ourselves keeps each row honest.
   */
  const [busyRowIds, setBusyRowIds] = useState<ReadonlySet<string>>(new Set());

  /**
   * A failed row action, kept against the row it belongs to rather than in the page-level
   * banner. Two rows can have a request in flight at once — that is what `busyRowIds` exists
   * for — and a single shared slot meant a later success wiped an earlier failure, leaving the
   * admin believing both worked. Attributing the message to its row is what makes concurrent
   * actions honest.
   */
  const [rowErrors, setRowErrors] = useState<ReadonlyMap<string, string>>(new Map());

  const markRowBusy = (id: string): void => setBusyRowIds((prev) => new Set(prev).add(id));

  const markRowIdle = (id: string): void =>
    setBusyRowIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const setRowError = (id: string, message: string): void =>
    setRowErrors((prev) => new Map(prev).set(id, message));

  const clearRowError = (id: string): void =>
    setRowErrors((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

  const clearMessages = (): void => {
    setActionError(null);
    setNotice(null);
  };

  /** Every mutation ends here — without the invalidation a new row stays invisible. */
  const refreshList = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY });

  const saveMutation = useMutation({
    mutationFn: (values: SubjectFormValue) =>
      editing && editing !== 'new'
        ? subjectsService.updateSubject(editing.id, values)
        : subjectsService.createSubject(values),
    onSuccess: async (saved) => {
      setActionError(null);
      setNotice(editing === 'new' ? `${saved.name} added.` : `${saved.name} saved.`);
      closeForm();
      await refreshList();
    },
    // A duplicate code is a 409 whose wording is the server's. Show it as-is.
    onError: (err: unknown) => {
      setNotice(null);
      setActionError(apiErrorMessage(err));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      subjectsService.setSubjectStatus(id, isActive),
    onMutate: ({ id }) => {
      markRowBusy(id);
      // A retry clears the previous attempt's message, so a stale error can't outlive it.
      clearRowError(id);
    },
    onSuccess: async (saved, variables) => {
      clearRowError(variables.id);
      setNotice(saved.isActive ? `${saved.name} reactivated.` : `${saved.name} deactivated.`);
      setPendingDeactivate(null);
      await refreshList();
    },
    // Deliberately NOT the page-level banner: a second row succeeding would overwrite it and
    // report success for a request that failed. The message stays on its own row instead.
    onError: (err: unknown, variables) => {
      setRowError(variables.id, apiErrorMessage(err));
      setPendingDeactivate(null);
    },
    onSettled: (_result, _err, variables) => markRowIdle(variables.id),
  });

  function openCreate(): void {
    clearMessages();
    setEditing('new');
  }

  function openEdit(subject: Subject): void {
    clearMessages();
    setEditing(subject);
  }

  function closeForm(): void {
    setEditing(null);
  }

  /** Deactivating is the destructive direction; reactivating needs no confirmation. */
  function requestStatusChange(subject: Subject): void {
    clearMessages();
    if (!subject.isActive) {
      statusMutation.mutate({ id: subject.id, isActive: true });
      return;
    }
    setPendingDeactivate(subject);
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? subjects.filter(
        (s) => s.code.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle),
      )
    : subjects;

  const columns: ColumnDef<Subject>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-sm">{row.code}</span>,
      width: '140px',
    },
    {
      key: 'name',
      header: 'Name',
      // The row's own failure sits under its name, where there is width for a sentence and
      // where it cannot be mistaken for a different row's problem.
      render: (row) => {
        const rowError = rowErrors.get(row.id);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.name}</span>
            {rowError && (
              <span role="alert" className="text-xs font-normal text-danger-foreground">
                {rowError}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ActiveBadge active={row.isActive} />,
      width: '120px',
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '110px',
      /**
       * Icon buttons, not word buttons — the same reasoning as the users list. Two labelled
       * buttons per row took more width than the code and name they belonged to. Each carries
       * its words in `label`, which is both the tooltip and what a screen reader announces, so
       * nothing is lost by dropping the visible text and the row reads as data again.
       */
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <IconButton
            icon={<Pencil size={15} aria-hidden />}
            label="Edit subject"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
          />
          {row.isActive ? (
            <IconButton
              icon={<Ban size={15} aria-hidden />}
              label="Deactivate subject"
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
              label="Activate subject"
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
  const isEditing = editing !== null && editing !== 'new';

  return (
    <>
      <PageHeader
        title="Subjects"
        subtitle="Manage the subjects and courses used across the curriculum"
        actions={
          // Hidden while the panel is open, so there is one obvious way out of the form —
          // the same as every other setup screen.
          editing === null && (
            <Button variant="primary" onClick={openCreate}>
              Add Subject
            </Button>
          )
        }
      />

      {/*
       * The action error wins. A failed list read is background noise the user did not ask for,
       * and nothing here refetches the list after a failed mutation — so letting it take
       * precedence would leave a 409 "that code is taken" permanently hidden behind a stale
       * "server is not responding" while the user retries the same duplicate code.
       */}
      {(actionError ?? listError) && (
        <Alert
          tone="danger"
          className="mb-4"
          // Only an action failure is dismissible. A failed list read is a standing condition,
          // not an event: hiding it would leave an empty table with no explanation, and it
          // clears itself the moment the list loads.
          {...(actionError
            ? { onDismiss: () => setActionError(null), dismissLabel: 'Dismiss error' }
            : {})}
        >
          {actionError ?? listError}
        </Alert>
      )}

      {notice && !listError && !actionError && (
        <Alert
          tone="success"
          className="mb-4"
          onDismiss={() => setNotice(null)}
          dismissLabel="Dismiss confirmation"
        >
          {notice}
        </Alert>
      )}

      {/*
       * Keyed by the row being edited, so switching targets remounts the form with fresh
       * initial values. That is the organism's documented reset mechanism — cheaper and
       * harder to get wrong than reaching in to reset it from here.
       */}
      {editing !== null && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {isEditing ? 'Edit Subject' : 'Add Subject'}
          </h2>
          <SubjectForm
            key={editing === 'new' ? 'new' : editing.id}
            mode={isEditing ? 'edit' : 'create'}
            {...(isEditing ? { initialValue: { code: editing.code, name: editing.name } } : {})}
            isSaving={saveMutation.isPending}
            onSave={(values) => saveMutation.mutate(values)}
            onCancel={closeForm}
          />
        </div>
      )}

      {subjects.length > 0 && (
        <div className="mb-4 max-w-xs">
          <Input
            type="search"
            aria-label="Search subjects"
            placeholder="Search subjects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<Subject>
          data={visible}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No subjects yet"
        />
      </div>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={() =>
          pendingDeactivate && statusMutation.mutate({ id: pendingDeactivate.id, isActive: false })
        }
        title={`Deactivate ${pendingDeactivate?.name ?? 'this subject'}?`}
        description="Anything already using it keeps working and keeps its marks. It stays on this list and can be reactivated at any time — but it will not be offered when building new curriculum, SLOs or exam papers."
        confirmLabel="Deactivate"
        tone="danger"
        busy={statusMutation.isPending}
      >
        {/*
         * A warning rather than a count. Nothing in the database references a subject yet, so
         * any usage figure shown here would be a hard zero — and a confident "0 in use" is more
         * dangerous than no number at all, because it reads as a check that was actually
         * performed. When curriculum lands, this becomes a real count (backlog item 3).
         */}
        <Alert tone="danger">
          This system cannot yet check whether a subject is in use. Confirm it is not needed for a
          current or upcoming exam cycle before withdrawing it.
        </Alert>
      </ConfirmDialog>
    </>
  );
}

export default SubjectsPage;
