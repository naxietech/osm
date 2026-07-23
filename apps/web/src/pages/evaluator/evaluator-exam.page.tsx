/**
 * My Work → one exam: the subjects of that exam this checker holds answers for.
 *
 * Second of three steps. Only subjects the checker has actually been given work in
 * appear — the exam's other subjects are none of their business.
 */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { type CheckerSubjectListItem } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { ChevronLeft } from '@/design-system/atoms/icon';
import { CountCell } from '@/design-system/molecules/count-cell';
import { LabeledProgress } from '@/design-system/molecules/labeled-progress';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useCurrentChecker } from '@/hooks';
import { ROUTES } from '@/router/routes';
import { listCheckerExams, listCheckerSubjects } from '@/services/marking.service';

export function EvaluatorExamPage(): React.ReactElement {
  const navigate = useNavigate();
  const { examId = '' } = useParams<{ examId: string }>();
  const checker = useCurrentChecker();

  const exam = checker ? listCheckerExams(checker.id).find((e) => e.examId === examId) : undefined;
  const rows = checker ? listCheckerSubjects(checker.id, examId) : [];

  // No exam here means the checker has no work in it — same answer as "does not exist",
  // and deliberately so: it must not confirm which exams they have no part in.
  if (!exam) {
    return (
      <>
        <PageHeader title="Exam not found" subtitle="You have no work assigned in this exam" />
        <Button variant="ghost" onClick={() => void navigate(ROUTES.evaluator.myWork)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to My Work
        </Button>
      </>
    );
  }

  const columns: ColumnDef<CheckerSubjectListItem & { id: string }>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <span>
          <span className="font-medium text-foreground">{row.subject}</span>
          <span className="block text-xs text-muted-foreground">
            {row.questionCount} question{row.questionCount === 1 ? '' : 's'} assigned to you
          </span>
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (row) => (
        <LabeledProgress
          percent={row.progressPercent}
          marked={row.markedScripts}
          total={row.totalScripts}
          label={row.subject}
        />
      ),
      width: '220px',
    },
    {
      key: 'pending',
      header: 'To mark',
      render: (row) => <CountCell value={row.pendingScripts} />,
      width: '100px',
    },
    {
      key: 'flagged',
      header: 'Flagged',
      render: (row) => <CountCell value={row.flaggedScripts} tone="warning" />,
      width: '100px',
    },
  ];

  return (
    <>
      <PageHeader
        title={exam.examName}
        subtitle={`${exam.session} — your subjects in this exam`}
        actions={
          <Button variant="ghost" onClick={() => void navigate(ROUTES.evaluator.myWork)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            My Work
          </Button>
        }
      />

      <DataTable
        data={rows.map((row) => ({ ...row, id: row.subjectId }))}
        columns={columns}
        emptyMessage="No subjects assigned to you in this exam."
        onRowClick={(row) =>
          void navigate(
            ROUTES.evaluator.workSubject.replace(':examId', examId).replace(':subjectId', row.id),
          )
        }
      />
    </>
  );
}

export default EvaluatorExamPage;
