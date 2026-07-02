/**
 * ExamsListPage — the board-side exam list (ADMIN and CONTROLLER).
 *
 * Mounted under /admin/exams and /controller/exams, so navigation is derived from
 * the path (role-agnostic), matching the SchoolsListPage / StudentsListPage pattern.
 * Admins can create exams and open an exam to edit it; controllers are read-only and
 * jump straight to an exam's candidate list.
 *
 * TODO: Replace the examService calls with React Query.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import type { ExamListItem } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { usePermissions } from '@/hooks';
import { examService } from '@/services/exam.service';

import { ExamStatusBadge } from './exam-status-badge';

export function ExamsListPage(): React.ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canManageExams } = usePermissions();

  // e.g. "/admin/exams/view" -> "/admin/exams"
  const base = pathname.slice(0, pathname.indexOf('/exams') + '/exams'.length);

  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void examService.listExams().then((data) => {
      if (active) {
        setExams(data);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  /** Admins edit an exam; controllers view its candidates. */
  const openExam = (id: string): void => {
    void navigate(canManageExams ? `${base}/${id}` : `${base}/${id}/candidates`);
  };

  const columns: ColumnDef<ExamListItem>[] = [
    {
      key: 'name',
      header: 'Exam',
      render: (row) => (
        <div>
          <span className="font-medium">{row.name}</span>
          <span className="block font-mono text-xs text-muted-foreground">{row.code}</span>
        </div>
      ),
    },
    {
      key: 'session',
      header: 'Session',
      render: (row) => row.session,
      width: '150px',
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (row) => `Grade ${row.gradeId}`,
      width: '110px',
    },
    {
      key: 'papers',
      header: 'Papers',
      render: (row) => row.paperCount,
      width: '90px',
    },
    {
      key: 'candidates',
      header: 'Candidates',
      render: (row) => row.candidateCount,
      width: '120px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ExamStatusBadge status={row.status} />,
      width: '180px',
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
            void navigate(`${base}/${row.id}/candidates`);
          }}
        >
          Candidates
        </Button>
      ),
      width: '130px',
    },
  ];

  return (
    <>
      <PageHeader
        title="Exams"
        subtitle="Exam sessions and their registered candidates"
        actions={
          canManageExams ? (
            <Button variant="primary" onClick={() => void navigate(`${base}/create`)}>
              Create Exam
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<ExamListItem>
          data={exams}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(row) => openExam(row.id)}
          emptyMessage="No exams yet"
        />
      </div>
    </>
  );
}

export default ExamsListPage;
