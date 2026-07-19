/**
 * Users list (super admin) — every login in the system. All users are created here by
 * the super admin; institutes don't manage their own logins. Many users can share one
 * institute, each with a single role.
 *
 * TODO: replace the direct users-store read with a usersApi + React Query.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { type SafeUser } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { roleName } from '@/services/roles.service';
import { instituteName, listUsers } from '@/services/users.service';

export function UsersListPage(): React.ReactElement {
  const navigate = useNavigate();
  const users = listUsers();

  const columns: ColumnDef<SafeUser>[] = [
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
    {
      key: 'role',
      header: 'Role',
      render: (row) => roleName(row.roleId),
      width: '150px',
    },
    {
      key: 'institute',
      header: 'Institute',
      render: (row) => (row.instituteId ? instituteName(row.instituteId) : '—'),
      width: '260px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Create and manage every login across institutes"
        actions={
          <Button variant="primary" onClick={() => void navigate('/admin/users/new')}>
            Add User
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<SafeUser> data={users} columns={columns} emptyMessage="No users found" />
      </div>
    </>
  );
}

export default UsersListPage;
