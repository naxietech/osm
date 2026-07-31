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

import type { AdminUser } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { UserStatusBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { instituteName } from '@/services/institute.service';
import { rolesService } from '@/services/roles.service';
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

export function UsersListPage(): React.ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users', page],
    queryFn: () => usersService.listUsers({ offset: page * USERS_PAGE_SIZE }),
  });

  // Roles are a small, stable list, fetched once so the table can name a user's role
  // without the API having to embed it on every row.
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => rolesService.listRoles() });

  const roleName = (roleId: string | undefined): string =>
    (roleId && rolesQuery.data?.find((r) => r.id === roleId)?.name) || '—';

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      usersService.setStatus(id, status),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    // The server refuses to suspend your own account or the last active Super Admin, and
    // says why — show its wording rather than restating the rule here.
    onError: (error: unknown) => setActionError(apiErrorMessage(error)),
  });

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
      width: '130px',
      render: (row) => (
        <Button
          variant="ghost"
          isLoading={statusMutation.isPending && statusMutation.variables?.id === row.id}
          onClick={() =>
            statusMutation.mutate({
              id: row.id,
              status: row.status === 'suspended' ? 'active' : 'suspended',
            })
          }
        >
          {row.status === 'suspended' ? 'Reactivate' : 'Suspend'}
        </Button>
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
        <div
          role="alert"
          className="mb-4 rounded-md bg-danger-subtle px-4 py-3 text-sm text-danger-foreground"
        >
          {listError ?? actionError}
        </div>
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
    </>
  );
}

export default UsersListPage;
