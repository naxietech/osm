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
import { useFormik } from 'formik';
import * as Yup from 'yup';

import type { Subject } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Input } from '@/design-system/atoms/input';
import { Alert } from '@/design-system/molecules/alert';
import { FormField } from '@/design-system/molecules/form-field';
import { ConfirmDialog, Modal } from '@/design-system/molecules/modal';
import { ActiveBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { SUBJECTS_KEY, useSubjects } from '@/hooks/use-subjects';
import { apiErrorMessage } from '@/services/api-client';
import { subjectsService } from '@/services/subjects.service';

/**
 * Mirrors the API's own limits (`subjects_code_chk` / `subjects_name_chk` and the Zod DTO), so
 * an obviously bad value fails before the round trip. The server still decides — this only
 * saves a request, it is not the guarantee.
 */
const subjectSchema = Yup.object({
  code: Yup.string()
    .trim()
    .max(20, 'At most 20 characters')
    .matches(/^[A-Za-z0-9_-]*$/, 'Letters, numbers, dashes and underscores only')
    .required('A code is required'),
  name: Yup.string().trim().max(100, 'At most 100 characters').required('A name is required'),
});

interface SubjectFormValues {
  code: string;
  name: string;
}

const EMPTY_FORM: SubjectFormValues = { code: '', name: '' };

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

  const markRowBusy = (id: string): void => setBusyRowIds((prev) => new Set(prev).add(id));

  const markRowIdle = (id: string): void =>
    setBusyRowIds((prev) => {
      const next = new Set(prev);
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
    mutationFn: (values: SubjectFormValues) =>
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
    onMutate: ({ id }) => markRowBusy(id),
    onSuccess: async (saved) => {
      setActionError(null);
      setNotice(saved.isActive ? `${saved.name} reactivated.` : `${saved.name} deactivated.`);
      setPendingDeactivate(null);
      await refreshList();
    },
    onError: (err: unknown) => {
      setNotice(null);
      setActionError(apiErrorMessage(err));
      setPendingDeactivate(null);
    },
    onSettled: (_result, _err, variables) => markRowIdle(variables.id),
  });

  const form = useFormik<SubjectFormValues>({
    initialValues: EMPTY_FORM,
    validationSchema: subjectSchema,
    // The dialog is reused for add and edit, so the values must follow whichever row opened it.
    enableReinitialize: true,
    onSubmit: (values) =>
      saveMutation.mutate({ code: values.code.trim(), name: values.name.trim() }),
  });

  function openCreate(): void {
    clearMessages();
    setEditing('new');
    form.resetForm({ values: EMPTY_FORM });
  }

  function openEdit(subject: Subject): void {
    clearMessages();
    setEditing(subject);
    form.resetForm({ values: { code: subject.code, name: subject.name } });
  }

  function closeForm(): void {
    setEditing(null);
    form.resetForm({ values: EMPTY_FORM });
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
      render: (row) => <span className="font-medium">{row.name}</span>,
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
      width: '180px',
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
            isLoading={busyRowIds.has(row.id)}
            onClick={(e) => {
              e.stopPropagation();
              requestStatusChange(row);
            }}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
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
          <Button variant="primary" onClick={openCreate}>
            Add Subject
          </Button>
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

      <Modal
        open={editing !== null}
        onClose={closeForm}
        title={isEditing ? 'Edit Subject' : 'Add Subject'}
        busy={saveMutation.isPending}
        footer={
          <>
            <Button variant="ghost" onClick={closeForm} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void form.submitForm()}
              isLoading={saveMutation.isPending}
              disabled={!form.isValid}
            >
              {isEditing ? 'Save Changes' : 'Add Subject'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="code"
            name="code"
            label="Code"
            value={form.values.code}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.code ? form.errors.code : undefined}
            required
          />
          <FormField
            id="name"
            name="name"
            label="Name"
            value={form.values.name}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.name ? form.errors.name : undefined}
            required
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={() =>
          pendingDeactivate && statusMutation.mutate({ id: pendingDeactivate.id, isActive: false })
        }
        title={`Deactivate ${pendingDeactivate?.name ?? 'this subject'}?`}
        description="It stays on this list and can be reactivated at any time, but it will no longer be offered when building curriculum, SLOs or exam papers."
        confirmLabel="Deactivate"
        tone="danger"
        busy={statusMutation.isPending}
      />
    </>
  );
}

export default SubjectsPage;
