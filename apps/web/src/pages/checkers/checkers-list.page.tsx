/**
 * Checkers list — shared by ADMIN (every checker) and INSTITUTE (its own only).
 *
 * The institute scoping is derived from the signed-in user's institute rather than the
 * URL, so an institute user cannot widen it by editing the path. Gated by
 * `checkers.manage`.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { type CheckerListItem, UserRole } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Badge, type BadgeProps } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { UserPlus } from '@/design-system/atoms/icon';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useAuth } from '@/hooks';
import { subjectNames } from '@/services/academic.service';
import { CHECKER_STATUS_LABEL, listCheckers } from '@/services/checker.service';
import { instituteName } from '@/services/institute.service';

const STATUS_VARIANT: Record<CheckerListItem['status'], BadgeProps['variant']> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

function subjectList(subjectIds: string[]): string {
  const names = subjectNames(subjectIds);
  return names.length > 0 ? names.join(', ') : '—';
}

export function CheckersListPage(): React.ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const base = pathname.slice(0, pathname.indexOf('/checkers') + '/checkers'.length);

  // An institute only ever sees its own checkers — scope comes from the user, not the URL.
  const isInstitute = user?.role === UserRole.INSTITUTE;
  const rows = listCheckers(isInstitute ? user?.instituteId : undefined);

  const columns: ColumnDef<CheckerListItem>[] = [
    {
      key: 'fullName',
      header: 'Checker',
      render: (row) => (
        <span>
          <span className="font-medium text-foreground">{row.fullName}</span>
          <span className="block font-mono text-xs text-muted-foreground">{row.checkerRefId}</span>
        </span>
      ),
    },
    {
      key: 'checkerType',
      header: 'Type',
      render: (row) =>
        row.checkerType === 'general' ? (
          <Badge variant="info">General</Badge>
        ) : (
          <span>
            <Badge>School-specific</Badge>
            <span className="mt-1 block text-xs text-muted-foreground">
              {instituteName(row.instituteId)}
            </span>
          </span>
        ),
      width: '220px',
    },
    {
      key: 'subjects',
      header: 'Subjects',
      render: (row) => <span className="text-muted-foreground">{subjectList(row.subjectIds)}</span>,
    },
    {
      key: 'experience',
      header: 'Marking exp.',
      render: (row) => `${row.yearsMarkingExperience} yr`,
      width: '120px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status]}>{CHECKER_STATUS_LABEL[row.status]}</Badge>
      ),
      width: '130px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Checkers"
        subtitle={
          isInstitute
            ? "Your institute's registered paper checkers"
            : 'Registered paper checkers across all institutes'
        }
        actions={
          <Button variant="primary" onClick={() => void navigate(`${base}/add`)}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Add Checker
          </Button>
        }
      />

      <DataTable
        data={rows}
        columns={columns}
        emptyMessage="No checkers registered yet."
        onRowClick={(row) => void navigate(`${base}/${row.id}`)}
      />
    </>
  );
}

export default CheckersListPage;
