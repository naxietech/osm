/**
 * StudentsListPage — follows the SchoolsListPage reference pattern.
 *
 * Shared by ADMIN and SCHOOL_STAFF (mounted under /admin/students and
 * /school/students), so navigation is derived from the current path rather than
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
    fullName: 'Ali Hassan',
    gradeId: 10,
    section: 'A',
    enrollmentStatus: 'active',
  },
  {
    id: 'stu_002',
    studentRefId: 'ref-9b2e7d44',
    fullName: 'Fatima Noor',
    gradeId: 12,
    section: 'B',
    enrollmentStatus: 'active',
  },
  {
    id: 'stu_003',
    studentRefId: 'ref-1a5c8e90',
    fullName: 'Bilal Ahmed',
    gradeId: 9,
    section: 'A',
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
      key: 'studentRefId',
      header: 'Ref ID',
      render: (row) => (
        <span className="font-mono text-sm text-muted-foreground">{row.studentRefId}</span>
      ),
      width: '170px',
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (row) => `Grade ${row.gradeId}`,
      width: '110px',
    },
    {
      key: 'section',
      header: 'Section',
      render: (row) => row.section ?? '—',
      width: '100px',
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
