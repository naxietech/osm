/**
 * Users list (super admin) — every login in the system, read from the API.
 *
 * All accounts are created here by the super admin; institutes don't manage their own
 * logins. Accounts are never deleted, only deactivated, so the audit log and anything a
 * user created keeps pointing at a real record.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import { type AdminUser, USER_STATUSES, type UserStatus } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Ban, KeyRound, Pencil, UserCheck } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { Alert } from '@/design-system/molecules/alert';
import { FilterBar } from '@/design-system/molecules/filter-bar';
import { FormField } from '@/design-system/molecules/form-field';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { UserStatusBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRoles } from '@/hooks/use-roles';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { instituteName } from '@/services/institute.service';
import { USERS_PAGE_SIZE, usersService } from '@/services/users.service';

const STATUS_LABELS: Record<UserStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  deactivate: 'Deactivated',
  locked: 'Locked',
};

const STATUS_OPTIONS = USER_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

/** Narrowed to a real status, so a hand-edited `?status=nonsense` is ignored, not sent on. */
function readStatus(raw: string | null): UserStatus | undefined {
  return USER_STATUSES.find((s) => s === raw);
}

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Search, filters and page live in the URL rather than in state, so the back button works,
   * a refresh keeps your place, and a narrowed list can be sent to someone as a link.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const status = readStatus(searchParams.get('status'));
  const roleId = searchParams.get('roleId') ?? '';
  const page = Math.max(0, Number(searchParams.get('page') ?? '1') - 1);

  /**
   * The box renders this immediately; only the debounced copy reaches the URL and the query,
   * so typing stays smooth and four keystrokes make one request rather than four.
   */
  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebouncedValue(searchInput);

  /**
   * Writes the given changes to the URL, dropping anything empty so the bar stays clean.
   *
   * `replace` decides whether the change is worth a history entry. Choosing a filter or a page
   * is a deliberate step you should be able to undo with Back; typing is not — pushing an entry
   * per keystroke would bury the previous screen under four of them.
   */
  const applyParams = (changes: Record<string, string>, replace = false): void =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace },
    );

  /**
   * Any change to what is being matched sends you back to page 1. Staying put would ask for
   * rows 51–75 of a result set that may now hold three — the API answers correctly with an
   * empty page, and it reads as "the search is broken".
   */
  const narrow = (changes: Record<string, string>, replace = false): void =>
    applyParams({ ...changes, page: '' }, replace);

  useEffect(() => {
    if (debouncedSearch !== q) narrow({ q: debouncedSearch }, true);
    // `q` is the settled URL value; re-running on it would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const clearFilters = (): void => {
    setSearchInput('');
    applyParams({ q: '', status: '', roleId: '', page: '' });
  };

  const setPage = (updater: (previous: number) => number): void =>
    applyParams({ page: String(updater(page) + 1) });

  /**
   * The edit screen finishes by coming back here, so it hands its confirmation over in the
   * navigation state — the page that did the work is gone by the time there is anything to
   * announce. Cleared immediately after reading, or a refresh would re-announce a change
   * that happened once, minutes ago.
   */
  const location = useLocation();
  const handedOverNotice = (location.state as { notice?: string } | null)?.notice;

  useEffect(() => {
    if (!handedOverNotice) return;
    setNotice(handedOverNotice);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handedOverNotice]);

  /** The row a dialog is open for, and which dialog. Null when none is open. */
  const [pendingDeactivate, setPendingDeactivate] = useState<AdminUser | null>(null);
  const [pendingActivate, setPendingActivate] = useState<AdminUser | null>(null);
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
    queryKey: ['users', { page, q, status, roleId }],
    queryFn: () =>
      usersService.listUsers({
        offset: page * USERS_PAGE_SIZE,
        q,
        status,
        roleId: roleId || undefined,
      }),
    enabled: isAuthenticated,
    // Without this the table blanks to a spinner on every keystroke's worth of new filters;
    // keeping the previous page visible while the next one loads makes narrowing feel live.
    placeholderData: (previous) => previous,
  });

  // Roles are a small, stable list, fetched once so the table can name a user's role
  // without the API having to embed it on every row.
  const { roles } = useRoles();

  const roleName = (roleId: string | undefined): string =>
    (roleId && roles.find((r) => r.id === roleId)?.name) || '—';

  const closeStatusDialogs = (): void => {
    setPendingDeactivate(null);
    setPendingActivate(null);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'deactivate' }) =>
      usersService.setStatus(id, status),
    onMutate: ({ id }) => markRowBusy(id),
    onSuccess: async (_result, variables) => {
      setActionError(null);
      setNotice(
        variables.status === 'deactivate'
          ? 'Account deactivated and signed out everywhere.'
          : 'Account reactivated. They can sign in again now.',
      );
      closeStatusDialogs();
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    // The server refuses to deactivate your own account or the last active Super Admin, and
    // says why — show its wording rather than restating the rule here.
    onError: (error: unknown) => {
      setNotice(null);
      setActionError(apiErrorMessage(error));
      closeStatusDialogs();
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

  /**
   * Both directions confirm. Reactivating is not destructive, but it is not trivial either —
   * it hands someone back their access, and on a long list the two buttons sit in the same
   * place, so a mis-click restores an account that was switched off deliberately.
   */
  const requestStatusChange = (user: AdminUser): void => {
    setNotice(null);
    setActionError(null);
    if (user.status === 'deactivate') setPendingActivate(user);
    else setPendingDeactivate(user);
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
      header: 'Actions',
      width: '150px',
      /**
       * Icon buttons, not word buttons. Two labelled buttons per row took more width than
       * the name and email they belonged to, and a third action would not have fitted at
       * all. Each carries its words in `label`, which is both the tooltip and what a screen
       * reader announces — so nothing is lost by dropping the visible text, and the row
       * reads as data again rather than as a toolbar.
       */
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <IconButton
            icon={<Pencil size={15} aria-hidden />}
            label={`Edit ${row.fullName}`}
            size="sm"
            onClick={() => void navigate(ROUTES.admin.userEdit.replace(':id', row.id))}
          />
          <IconButton
            icon={<KeyRound size={15} aria-hidden />}
            label="Reset password"
            size="sm"
            onClick={() => {
              setNotice(null);
              setActionError(null);
              setPendingReset(row);
            }}
          />
          {row.status === 'deactivate' ? (
            <IconButton
              icon={<UserCheck size={15} aria-hidden />}
              label="Reactivate account"
              size="sm"
              isLoading={busyRowIds.has(row.id)}
              onClick={() => requestStatusChange(row)}
            />
          ) : (
            <IconButton
              icon={<Ban size={15} aria-hidden />}
              label="Deactivate account"
              tone="danger"
              size="sm"
              isLoading={busyRowIds.has(row.id)}
              onClick={() => requestStatusChange(row)}
            />
          )}
        </div>
      ),
    },
  ];

  const isNarrowed = q.trim().length > 0 || status !== undefined || roleId !== '';
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
        <Alert
          tone="danger"
          className="mb-4"
          // A failed action is dismissible; a failed *load* is not — the table below it is
          // empty, and hiding the reason would leave the screen looking like "no users".
          onDismiss={listError ? undefined : () => setActionError(null)}
          dismissLabel="Dismiss error"
        >
          {listError ?? actionError}
        </Alert>
      )}

      {notice && !listError && !actionError && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <FilterBar
        className="mb-4"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchLabel="Search users"
        searchPlaceholder="Search name or email…"
        filters={[
          {
            id: 'role-filter',
            label: 'Role',
            value: roleId,
            allLabel: 'All roles',
            options: roles.map((r) => ({ value: r.id, label: r.name })),
            onChange: (value) => narrow({ roleId: value }),
          },
          {
            id: 'status-filter',
            label: 'Status',
            value: status ?? '',
            allLabel: 'All statuses',
            options: STATUS_OPTIONS,
            onChange: (value) => narrow({ status: value }),
          },
        ]}
        onClear={clearFilters}
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<AdminUser>
          data={usersQuery.data?.items ?? []}
          columns={columns}
          isLoading={usersQuery.isLoading}
          emptyMessage={isNarrowed ? 'No users match those filters' : 'No users found'}
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
        open={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={() =>
          pendingDeactivate &&
          statusMutation.mutate({ id: pendingDeactivate.id, status: 'deactivate' })
        }
        title={`Deactivate ${pendingDeactivate?.fullName ?? 'this account'}?`}
        description="They will be signed out of every device immediately and cannot sign in again until someone reactivates the account."
        confirmLabel="Deactivate"
        tone="danger"
        busy={statusMutation.isPending}
      />

      <ConfirmDialog
        open={pendingActivate !== null}
        onClose={() => setPendingActivate(null)}
        onConfirm={() =>
          pendingActivate && statusMutation.mutate({ id: pendingActivate.id, status: 'active' })
        }
        title={`Reactivate ${pendingActivate?.fullName ?? 'this account'}?`}
        description="They will be able to sign in again immediately, and any lockout from failed login attempts is cleared. Their old sessions stay signed out, so they must log in again."
        confirmLabel="Reactivate"
        tone="primary"
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
