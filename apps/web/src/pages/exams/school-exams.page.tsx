/**
 * SchoolExamsPage (SCHOOL_STAFF) — the school's exams: ones open for registration plus
 * any it has already registered candidates into (so its candidates stay visible after
 * the window closes). Row click opens the register / view screen for that exam.
 *
 * TODO: Replace the service call with React Query.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useAuth } from '@/hooks';
import { ROUTES } from '@/router/routes';
import { type SchoolExamRow, examRegistrationService } from '@/services/exam-registration.service';

import { ExamStatusBadge } from './exam-status-badge';

type Row = SchoolExamRow & { id: string };

/** Build the register / view path for an exam id (school route only). */
function examPath(examId: string): string {
  return ROUTES.school.examRegister.replace(':id', examId);
}

export function SchoolExamsPage(): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.schoolId ?? '';

  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }
    let active = true;
    void examRegistrationService.listSchoolExams(schoolId).then((data) => {
      if (active) {
        setRows(data.map((r) => ({ ...r, id: r.exam.id })));
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [schoolId]);

  const columns: ColumnDef<Row>[] = [
    {
      key: 'name',
      header: 'Exam',
      render: (row) => (
        <div>
          <span className="font-medium">{row.exam.name}</span>
          <span className="block font-mono text-xs text-muted-foreground">{row.exam.code}</span>
        </div>
      ),
    },
    {
      key: 'session',
      header: 'Session',
      render: (row) => row.exam.session,
      width: '150px',
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (row) => `Grade ${row.exam.gradeId}`,
      width: '110px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ExamStatusBadge status={row.exam.status} />,
      width: '180px',
    },
    {
      key: 'registered',
      header: 'Your Candidates',
      render: (row) => row.registeredCount,
      width: '150px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant={row.canRegister ? 'primary' : 'ghost'}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            void navigate(examPath(row.exam.id));
          }}
        >
          {row.canRegister ? 'Register' : 'View'}
        </Button>
      ),
      width: '150px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Exams"
        subtitle="Register your students and view your registered candidates"
      />

      {!schoolId ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          Your account isn&apos;t linked to a school.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <DataTable<Row>
            data={rows}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(row) => void navigate(examPath(row.exam.id))}
            emptyMessage="No exams open for registration, and none with your candidates yet"
          />
        </div>
      )}
    </>
  );
}

export default SchoolExamsPage;
