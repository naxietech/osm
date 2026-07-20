/**
 * Roles list (super admin) — every role in the system: the seeded system roles plus
 * any custom roles. System roles are read-only; custom roles can be edited. "Create
 * Role" opens the permission-matrix editor.
 *
 * TODO: replace the direct roles-store read with a rolesApi + React Query.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { type Role } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { listRoles } from '@/services/roles.service';
import { instituteName } from '@/services/users.service';

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
  const roles = listRoles();

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
      width: '260px',
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
            void navigate(`/admin/roles/${row.id}`);
          }}
        >
          {row.isSystem ? 'View' : 'Edit'}
        </Button>
      ),
      width: '100px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define roles and assign what each role can do"
        actions={
          <Button variant="primary" onClick={() => void navigate('/admin/roles/new')}>
            Create Role
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<Role>
          data={roles}
          columns={columns}
          onRowClick={(row) => void navigate(`/admin/roles/${row.id}`)}
          emptyMessage="No roles found"
        />
      </div>
    </>
  );
}

export default RolesListPage;
