/**
 * StudentsListPage — follows the InstitutesListPage reference pattern.
 *
 * Shared by ADMIN and INSTITUTE (mounted under /admin/students and
 * /institute/students), so navigation is derived from the current path rather than
 * hard-coded — the page is role-agnostic. The list is PII-safe: StudentListItem
 * carries no CNIC / DOB.
 *
 * TODO: Replace MOCK_STUDENTS with an API call via React Query.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import type { EnrollmentStatus, StudentListItem } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Badge, type BadgeProps } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';

const MOCK_STUDENTS: StudentListItem[] = [
  {
    id: 'stu_001',
    studentRefId: 'ref-3f8a1c20',
    registrationNumber: '2600420001',
    fullName: 'Ali Hassan',
    levelId: 'lvl_10',
    groupId: 'grp_science',
    classNumber: 10,
    enrollmentStatus: 'active',
  },
  {
    id: 'stu_002',
    studentRefId: 'ref-9b2e7d44',
    registrationNumber: '2600420003',
    fullName: 'Fatima Noor',
    levelId: 'lvl_12',
    groupId: 'grp_premed',
    classNumber: 12,
    enrollmentStatus: 'active',
  },
  {
    id: 'stu_003',
    studentRefId: 'ref-1a5c8e90',
    registrationNumber: '2600420002',
    fullName: 'Bilal Ahmed',
    levelId: 'lvl_9',
    groupId: 'grp_science',
    classNumber: 9,
    enrollmentStatus: 'inactive',
  },
];

const STATUS_CONFIG: Record<EnrollmentStatus, { label: string; variant: BadgeProps['variant'] }> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'default' },
  transferred: { label: 'Transferred', variant: 'warning' },
  graduated: { label: 'Graduated', variant: 'info' },
};

export function StudentsListPage(): React.ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // e.g. "/admin/students/view" or "/school/students/view" -> ".../students"
  const base = pathname.slice(0, pathname.indexOf('/students') + '/students'.length);

  const columns: ColumnDef<StudentListItem>[] = [
    {
      key: 'fullName',
      header: 'Student Name',
      render: (row) => <span className="font-medium">{row.fullName}</span>,
    },
    {
      key: 'registrationNumber',
      header: 'Reg No.',
      render: (row) => (
        <span className="font-mono text-sm text-muted-foreground">
          {row.registrationNumber ?? '—'}
        </span>
      ),
      width: '130px',
    },
    {
      key: 'class',
      header: 'Class',
      render: (row) => `Class ${row.classNumber}`,
      width: '110px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const config = STATUS_CONFIG[row.enrollmentStatus];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
      width: '140px',
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
            void navigate(`${base}/${row.id}`);
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
        title="Students"
        subtitle="Manage student enrolment"
        actions={
          <Button variant="primary" onClick={() => void navigate(`${base}/manage`)}>
            Add Student
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<StudentListItem>
          data={MOCK_STUDENTS}
          columns={columns}
          onRowClick={(row) => void navigate(`${base}/${row.id}`)}
          emptyMessage="No students found"
        />
      </div>
    </>
  );
}

export default StudentsListPage;
