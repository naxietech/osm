/**
 * Users list (super admin) — every login in the system, read from the API.
 *
 * All accounts are created here by the super admin; institutes don't manage their own
 * logins. Accounts are never deleted, only suspended, so the audit log and anything a
 * user created keeps pointing at a real record.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import type { AdminUser } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Alert } from '@/design-system/molecules/alert';
import { FormField } from '@/design-system/molecules/form-field';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { UserStatusBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useAuth } from '@/hooks/use-auth';
import { useRoles } from '@/hooks/use-roles';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { instituteName } from '@/services/institute.service';
import { USERS_PAGE_SIZE, usersService } from '@/services/users.service';

/** ISO timestamp → short local date, or a word when the user has never signed in. */
function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Mirrors the API's own minimum, so the dialog fails before the round trip. */
const resetPasswordSchema = Yup.object({
  password: Yup.string()
    .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`)
    .required('A temporary password is required'),
});

export function UsersListPage(): React.ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** The row a dialog is open for, and which dialog. Null when none is open. */
  const [pendingSuspend, setPendingSuspend] = useState<AdminUser | null>(null);
  const [pendingReset, setPendingReset] = useState<AdminUser | null>(null);

  /**
   * Which rows have a status change in flight. Every row shares one mutation, and React
   * Query's `variables` only ever describe the most recent call — so reading it would make
   * the first row's spinner stop the moment a second row is clicked, while its request is
   * still running. Tracking ids ourselves keeps each row honest.
   */
  const [busyRowIds, setBusyRowIds] = useState<ReadonlySet<string>>(new Set());

  const markRowBusy = (id: string): void => setBusyRowIds((prev) => new Set(prev).add(id));

  const markRowIdle = (id: string): void =>
    setBusyRowIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // `enabled` for the same reason as use-roles: signing out drops this query, and a dropped
  // query that a mounted screen is still watching asks again — with the session just ended.
  const usersQuery = useQuery({
    queryKey: ['users', page],
    queryFn: () => usersService.listUsers({ offset: page * USERS_PAGE_SIZE }),
    enabled: isAuthenticated,
  });

  // Roles are a small, stable list, fetched once so the table can name a user's role
  // without the API having to embed it on every row.
  const { roles } = useRoles();

  const roleName = (roleId: string | undefined): string =>
    (roleId && roles.find((r) => r.id === roleId)?.name) || '—';

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      usersService.setStatus(id, status),
    onMutate: ({ id }) => markRowBusy(id),
    onSuccess: async (_result, variables) => {
      setActionError(null);
      setNotice(
        variables.status === 'suspended'
          ? 'Account suspended and signed out everywhere.'
          : 'Account reactivated.',
      );
      setPendingSuspend(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    // The server refuses to suspend your own account or the last active Super Admin, and
    // says why — show its wording rather than restating the rule here.
    onError: (error: unknown) => {
      setNotice(null);
      setActionError(apiErrorMessage(error));
      setPendingSuspend(null);
    },
    onSettled: (_result, _error, variables) => markRowIdle(variables.id),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersService.resetPassword(id, password),
    onSuccess: () => {
      setActionError(null);
      setNotice('Password reset. Share it with the user — they were signed out everywhere.');
      closeResetDialog();
    },
    onError: (error: unknown) => {
      setNotice(null);
      setActionError(apiErrorMessage(error));
    },
  });

  /**
   * The temporary-password field. Formik + Yup like every other form in the app — it was
   * the one place still on `useState` with the length rule written out at each use site.
   */
  const resetPasswordForm = useFormik({
    initialValues: { password: '' },
    validationSchema: resetPasswordSchema,
    onSubmit: ({ password }) => {
      if (pendingReset) resetMutation.mutate({ id: pendingReset.id, password });
    },
  });

  function closeResetDialog(): void {
    setPendingReset(null);
    // Never leave a typed password sitting in state behind a closed dialog.
    resetPasswordForm.resetForm();
  }

  /** Suspending is the destructive direction; reactivating needs no confirmation. */
  const requestStatusChange = (user: AdminUser): void => {
    if (user.status === 'suspended') {
      statusMutation.mutate({ id: user.id, status: 'active' });
      return;
    }
    setNotice(null);
    setActionError(null);
    setPendingSuspend(user);
  };

  const columns: ColumnDef<AdminUser>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (row) => <span className="font-medium">{row.fullName}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="text-muted-foreground">{row.email}</span>,
    },
    { key: 'role', header: 'Role', render: (row) => roleName(row.roleId), width: '150px' },
    {
      key: 'institute',
      header: 'Institute',
      render: (row) => (row.instituteId ? instituteName(row.instituteId) : '—'),
      width: '220px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <UserStatusBadge status={row.status} />,
      width: '110px',
    },
    {
      key: 'lastLoginAt',
      header: 'Last Sign-In',
      render: (row) => (
        <span className="text-muted-foreground">{formatLastLogin(row.lastLoginAt)}</span>
      ),
      width: '130px',
    },
    {
      key: 'actions',
      header: '',
      width: '210px',
      // Both were `ghost`, which paints as bare text — two words in a table cell with no
      // border or fill do not read as things you can press, and the destructive one looked
      // identical to the harmless one. Outlined for "this is a control", danger for the
      // action that signs someone out of every device.
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setNotice(null);
              setActionError(null);
              setPendingReset(row);
            }}
          >
            Reset password
          </Button>
          <Button
            variant={row.status === 'suspended' ? 'secondary' : 'danger'}
            size="sm"
            isLoading={busyRowIds.has(row.id)}
            disabled={busyRowIds.has(row.id)}
            onClick={() => requestStatusChange(row)}
          >
            {row.status === 'suspended' ? 'Reactivate' : 'Suspend'}
          </Button>
        </div>
      ),
    },
  ];

  const total = usersQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const firstShown = total === 0 ? 0 : page * USERS_PAGE_SIZE + 1;
  const lastShown = Math.min((page + 1) * USERS_PAGE_SIZE, total);
  const listError = usersQuery.isError ? apiErrorMessage(usersQuery.error) : null;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Create and manage every login across institutes"
        actions={
          <Button variant="primary" onClick={() => void navigate(ROUTES.admin.usersNew)}>
            Add User
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

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<AdminUser>
          data={usersQuery.data?.items ?? []}
          columns={columns}
          isLoading={usersQuery.isLoading}
          emptyMessage="No users found"
        />
      </div>

      {total > USERS_PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {firstShown}–{lastShown} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="ghost"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingSuspend !== null}
        onClose={() => setPendingSuspend(null)}
        onConfirm={() =>
          pendingSuspend && statusMutation.mutate({ id: pendingSuspend.id, status: 'suspended' })
        }
        title={`Suspend ${pendingSuspend?.fullName ?? 'this account'}?`}
        description="They will be signed out of every device immediately and cannot sign in again until someone reactivates the account."
        confirmLabel="Suspend"
        tone="danger"
        busy={statusMutation.isPending}
      />

      <ConfirmDialog
        open={pendingReset !== null}
        onClose={closeResetDialog}
        onConfirm={() => void resetPasswordForm.submitForm()}
        title={`Reset password for ${pendingReset?.fullName ?? 'this account'}`}
        description="Set a temporary password and pass it on yourself — there is no reset email. They will be signed out everywhere."
        confirmLabel="Reset password"
        busy={resetMutation.isPending}
        confirmDisabled={!resetPasswordForm.isValid || !resetPasswordForm.dirty}
      >
        <FormField
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          label="Temporary Password"
          value={resetPasswordForm.values.password}
          onChange={resetPasswordForm.handleChange}
          onBlur={resetPasswordForm.handleBlur}
          // Shown as soon as anything has been typed, not only after blur: in a dialog whose
          // confirm button is disabled until the value is valid, waiting for blur leaves the
          // user looking at a dead button with no explanation.
          error={
            resetPasswordForm.touched.password || resetPasswordForm.values.password.length > 0
              ? resetPasswordForm.errors.password
              : undefined
          }
          required
        />
      </ConfirmDialog>
    </>
  );
}

export default UsersListPage;
