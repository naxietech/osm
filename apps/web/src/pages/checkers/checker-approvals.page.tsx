/**
 * Checker Approvals (super admin) — the queue of registrations awaiting review, whether
 * an institute or the super admin added them.
 *
 * This screen is a LIST only. Clicking a row opens the shared checker detail page, which
 * is where the record is read and approved or rejected — the same page the ordinary
 * checkers list opens, so there is one view of a checker rather than two that can drift.
 * Gated by `checkers.approve`.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { type Checker } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Badge } from '@/design-system/atoms/badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { ROUTES } from '@/router/routes';
import { subjects } from '@/services/academic.service';
import { listPendingCheckers } from '@/services/checker.service';
import { instituteName } from '@/services/users.service';

function subjectNames(subjectIds: string[]): string {
  const names = subjectIds.map((id) => subjects.find((s) => s.id === id)?.name ?? id);
  return names.length > 0 ? names.join(', ') : '—';
}

export function CheckerApprovalsPage(): React.ReactElement {
  const navigate = useNavigate();
  const pending = listPendingCheckers();

  const columns: ColumnDef<Checker>[] = [
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
      key: 'qualification',
      header: 'Qualification',
      render: (row) => (
        <span>
          <span className="text-foreground">{row.highestQualification}</span>
          <span className="block text-xs text-muted-foreground">{row.specialization}</span>
        </span>
      ),
    },
    {
      key: 'subjects',
      header: 'Subjects',
      render: (row) => (
        <span className="text-muted-foreground">{subjectNames(row.subjectIds)}</span>
      ),
    },
    {
      key: 'experience',
      header: 'Marking exp.',
      render: (row) => `${row.yearsMarkingExperience} yr`,
      width: '120px',
    },
    {
      key: 'documents',
      header: 'Documents',
      render: (row) =>
        row.documents.length === 0 ? (
          <Badge variant="error">None</Badge>
        ) : (
          <Badge variant="default">{row.documents.length} attached</Badge>
        ),
      width: '130px',
    },
    {
      key: 'addedBy',
      header: 'Added by',
      render: (row) => (row.addedBy === 'institute' ? 'Institute' : 'Super admin'),
      width: '120px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Checker Approvals"
        subtitle="Open a registration to review it and approve or reject"
      />

      <DataTable
        data={pending}
        columns={columns}
        emptyMessage="No checker registrations are waiting for review."
        onRowClick={(row) => void navigate(ROUTES.admin.checkerDetail.replace(':id', row.id))}
      />
    </>
  );
}

export default CheckerApprovalsPage;
