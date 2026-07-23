/**
 * My Work — the exams this checker has been given work in.
 *
 * The top of a three-step drill-down: exam → subject → answer. Scope comes from the
 * signed-in user's own checker record, never from the URL, so a checker cannot see
 * someone else's workload by editing the path.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { type CheckerExamListItem } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { CountCell } from '@/design-system/molecules/count-cell';
import { LabeledProgress } from '@/design-system/molecules/labeled-progress';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useCurrentChecker } from '@/hooks';
import { ROUTES } from '@/router/routes';
import { listCheckerExams } from '@/services/marking.service';

const columns: ColumnDef<CheckerExamListItem>[] = [
  {
    key: 'exam',
    header: 'Exam',
    render: (row) => (
      <span>
        <span className="font-medium text-foreground">{row.examName}</span>
        <span className="block text-xs text-muted-foreground">{row.session}</span>
      </span>
    ),
  },
  {
    key: 'scope',
    header: 'Your work',
    render: (row) => (
      <span className="text-muted-foreground">
        {row.subjectCount} subject{row.subjectCount === 1 ? '' : 's'} · {row.questionCount} question
        {row.questionCount === 1 ? '' : 's'}
      </span>
    ),
    width: '200px',
  },
  {
    key: 'progress',
    header: 'Progress',
    render: (row) => (
      <LabeledProgress
        percent={row.progressPercent}
        marked={row.markedScripts}
        total={row.totalScripts}
        label={row.examName}
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

export function EvaluatorQueuePage(): React.ReactElement {
  const navigate = useNavigate();
  const checker = useCurrentChecker();
  const rows = checker ? listCheckerExams(checker.id) : [];

  return (
    <>
      <PageHeader title="My Work" subtitle="Exams you have been given answers to mark" />

      <DataTable
        data={rows.map((row) => ({ ...row, id: row.examId }))}
        columns={columns}
        emptyMessage="Nothing assigned to you right now."
        onRowClick={(row) => void navigate(ROUTES.evaluator.workExam.replace(':examId', row.id))}
      />
    </>
  );
}

export default EvaluatorQueuePage;
