/**
 * ExamCandidatesPage (ADMIN / CONTROLLER) — the candidate list for one exam.
 *
 * Read-only for controllers. Admins can close the window and assign roll numbers from
 * here too. Names are shown because only ADMIN/CONTROLLER reach this page (both may
 * view PII); evaluators never do — their candidate view would use studentRefId only.
 *
 * TODO: Replace service calls with React Query.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  type CandidateListItem,
  type Exam,
  ExamStatus,
  type RegistrationStatus,
} from '@oses/types';

import { Badge, type BadgeProps } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { Check, ChevronLeft } from '@/design-system/atoms/icon';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { usePermissions } from '@/hooks';
import { examRegistrationService } from '@/services/exam-registration.service';
import { examService } from '@/services/exam.service';

import { ExamStatusBadge } from './exam-status-badge';

type CandidateRow = CandidateListItem & { id: string };

const STATUS_BADGE: Record<RegistrationStatus, { label: string; variant: BadgeProps['variant'] }> =
  {
    pending: { label: 'Pending', variant: 'warning' },
    confirmed: { label: 'Confirmed', variant: 'success' },
    withdrawn: { label: 'Withdrawn', variant: 'default' },
  };

export function ExamCandidatesPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canManageExams } = usePermissions();
  const base = pathname.slice(0, pathname.indexOf('/exams') + '/exams'.length);

  const [exam, setExam] = useState<Exam | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!id) return;
    const [examData, candidateData] = await Promise.all([
      examService.getExam(id),
      examRegistrationService.listCandidates(id),
    ]);
    setExam(examData ?? null);
    setCandidates(candidateData.map((c) => ({ ...c, id: c.registrationId })));
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeAndAssign = (): void => {
    if (!id) return;
    setStatusBusy(true);
    setSuccessMessage(null);
    void examService.assignRollNumbers(id).then(() =>
      load().then(() => {
        setSuccessMessage('Registration closed and roll numbers assigned.');
        setStatusBusy(false);
      }),
    );
  };

  const columns: ColumnDef<CandidateRow>[] = [
    {
      key: 'rollNumber',
      header: 'Roll No.',
      render: (row) =>
        row.rollNumber ? (
          <span className="font-mono text-sm">{row.rollNumber}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      width: '160px',
    },
    {
      key: 'fullName',
      header: 'Candidate',
      render: (row) => <span className="font-medium">{row.fullName ?? '—'}</span>,
    },
    {
      key: 'studentRefId',
      header: 'Ref ID',
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.studentRefId}</span>
      ),
      width: '150px',
    },
    {
      key: 'electives',
      header: 'Electives',
      render: (row) =>
        row.electiveSubjects.length > 0 ? (
          row.electiveSubjects.join(', ')
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const config = STATUS_BADGE[row.status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
      width: '130px',
    },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate(base)}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to Exams
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-foreground">
              {exam ? exam.name : 'Candidates'}
            </h1>
            {exam && <ExamStatusBadge status={exam.status} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {exam ? `${exam.code} · ${exam.session}` : ''} · {candidates.length}{' '}
            {candidates.length === 1 ? 'candidate' : 'candidates'}
          </p>
        </div>

        {canManageExams && exam?.status === ExamStatus.REGISTRATION_OPEN && (
          <Button size="sm" onClick={closeAndAssign} isLoading={statusBusy}>
            Close &amp; Assign Roll Numbers
          </Button>
        )}
      </div>

      {successMessage && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-sm font-medium text-success-foreground"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
          {successMessage}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<CandidateRow>
          data={candidates}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No candidates registered yet"
        />
      </div>
    </>
  );
}

export default ExamCandidatesPage;
