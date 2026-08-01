/**
 * Roles list (super admin) — every role in the system, read from the API.
 *
 * Read-only: the backend seeds the five TRD roles and exposes only `GET /roles`. Creating
 * and editing roles is designed for (the editor and `CreateRoleDto` exist) but has no
 * endpoint yet, so those actions stay hidden rather than pretending to save.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { type Role } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Alert } from '@/design-system/molecules/alert';
import { RoleTypeBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useRoles } from '@/hooks/use-roles';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';
import { instituteName } from '@/services/institute.service';

export function RolesListPage(): React.ReactElement {
  const navigate = useNavigate();
  const { roles, isLoading, isError, error } = useRoles();

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
      render: (row) => <RoleTypeBadge isSystem={row.isSystem} />,
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

      {isError && (
        <Alert tone="danger" className="mb-4">
          {apiErrorMessage(error)}
        </Alert>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<Role>
          data={roles}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(row) => openRole(row.id)}
          emptyMessage="No roles found"
        />
      </div>
    </>
  );
}

export default RolesListPage;
