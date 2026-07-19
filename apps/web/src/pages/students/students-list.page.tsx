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
import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { type EnrollmentStatus, type StudentListItem, UserRole } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Badge, type BadgeProps } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { Check, Upload, X } from '@/design-system/atoms/icon';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useAuth } from '@/hooks';

/** Minimal CSV parser (mock): first row = headers, comma-separated, no quoted-comma support. */
interface ParsedCsv {
  headers: string[];
  rows: string[][];
}
function parseCsv(text: string): ParsedCsv {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const headers = (lines[0] ?? '').split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((c) => c.trim()));
  return { headers, rows };
}

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
  const { user } = useAuth();
  // e.g. "/admin/students/view" or "/school/students/view" -> ".../students"
  const base = pathname.slice(0, pathname.indexOf('/students') + '/students'.length);

  // CSV bulk import is an admin-only tool.
  const isAdmin = user?.role === UserRole.ADMIN;
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportedCount(null);
    const reader = new FileReader();
    reader.onload = () => setParsed(parseCsv(String(reader.result ?? '')));
    reader.readAsText(file);
    e.target.value = ''; // allow re-picking the same file
  };
  const confirmImport = (): void => {
    // Mock: no student store yet — record the count so the flow is visible end-to-end.
    setImportedCount(parsed?.rows.length ?? 0);
    setParsed(null);
  };

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
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" aria-hidden />
                Import Students
              </Button>
            )}
            <Button variant="primary" onClick={() => void navigate(`${base}/manage`)}>
              Add Student
            </Button>
          </div>
        }
      />

      {/* Hidden file input for CSV import (admin) */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onPickFile}
      />

      {importedCount !== null && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-sm font-medium text-success-foreground"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
          Imported {importedCount} student{importedCount === 1 ? '' : 's'}.
        </div>
      )}

      {/* CSV preview before confirming the import */}
      {parsed && (
        <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Preview import</h2>
              <p className="text-xs text-muted-foreground">
                {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'} · columns:{' '}
                {parsed.headers.join(', ')}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  {parsed.headers.map((h) => (
                    <th key={h} className="py-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {parsed.headers.map((_, ci) => (
                      <td key={ci} className="py-2 pr-4 text-foreground">
                        {row[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.rows.length > 5 && (
              <p className="mt-2 text-xs text-muted-foreground">
                …and {parsed.rows.length - 5} more
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setParsed(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={parsed.rows.length === 0} onClick={confirmImport}>
              Import {parsed.rows.length} Student{parsed.rows.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}

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
