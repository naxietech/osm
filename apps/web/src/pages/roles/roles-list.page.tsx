/**
 * Roles list (super admin) — every role in the system, read from the API.
 *
 * Read-only: the backend seeds the five TRD roles and exposes only `GET /roles`. Creating
 * and editing roles is designed for (the editor and `CreateRoleDto` exist) but has no
 * endpoint yet, so those actions stay hidden rather than pretending to save.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { type Role } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { instituteName } from '@/services/institute.service';
import { rolesService } from '@/services/roles.service';

function TypePill({ isSystem }: { isSystem: boolean }): React.ReactElement {
  return isSystem ? (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      System
    </span>
  ) : (
    <span className="rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-medium text-brand">
      Custom
    </span>
  );
}

export function RolesListPage(): React.ReactElement {
  const navigate = useNavigate();
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: () => rolesService.listRoles() });

  const openRole = (id: string): void => void navigate(`${ROUTES.admin.roles}/${id}`);

  const columns: ColumnDef<Role>[] = [
    {
      key: 'name',
      header: 'Role',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <TypePill isSystem={row.isSystem} />,
      width: '120px',
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => (row.instituteId ? instituteName(row.instituteId) : 'Global'),
      width: '240px',
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (row) => (
        <span className="text-muted-foreground">
          {row.grants.length} {row.grants.length === 1 ? 'permission' : 'permissions'}
        </span>
      ),
      width: '150px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openRole(row.id);
          }}
        >
          View
        </Button>
      ),
      width: '100px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="What each role in the system is allowed to do"
      />

      {rolesQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-danger-subtle px-4 py-3 text-sm text-danger-foreground"
        >
          {apiErrorMessage(rolesQuery.error)}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<Role>
          data={rolesQuery.data ?? []}
          columns={columns}
          isLoading={rolesQuery.isLoading}
          onRowClick={(row) => openRole(row.id)}
          emptyMessage="No roles found"
        />
      </div>
    </>
  );
}

export default RolesListPage;
