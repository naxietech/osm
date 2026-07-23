/**
 * History — batches the checker has finished, most recently completed first.
 *
 * A batch counts as finished when nothing is left pending, which includes batches whose
 * remainder was flagged to a supervisor: the checker can do no more with those, so they
 * belong here rather than sitting in the queue.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { type MarkingBatchListItem } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useCurrentChecker } from '@/hooks';
import { formatDate } from '@/lib/utils';
import { ROUTES } from '@/router/routes';
import { listCompletedBatches } from '@/services/marking.service';

const columns: ColumnDef<MarkingBatchListItem>[] = [
  {
    key: 'subject',
    header: 'Batch',
    render: (row) => (
      <span>
        <span className="font-medium text-foreground">{row.subject}</span>
        <span className="block text-xs text-muted-foreground">{row.scopeLabel}</span>
      </span>
    ),
  },
  {
    key: 'marked',
    header: 'Marked',
    render: (row) => (
      <span className="tabular-nums">
        {row.markedScripts} of {row.totalScripts}
      </span>
    ),
    width: '140px',
  },
  {
    key: 'flagged',
    header: 'Flagged',
    render: (row) =>
      row.flaggedScripts > 0 ? (
        <span className="tabular-nums text-warning-foreground">{row.flaggedScripts}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    width: '90px',
  },
  {
    key: 'completedAt',
    header: 'Completed',
    render: (row) => <span className="text-muted-foreground">{formatDate(row.completedAt)}</span>,
    width: '160px',
  },
];

export function EvaluatorHistoryPage(): React.ReactElement {
  const navigate = useNavigate();
  const checker = useCurrentChecker();
  const rows = checker ? listCompletedBatches(checker.id) : [];

  return (
    <>
      <PageHeader title="History" subtitle="Batches you have finished marking" />

      <DataTable
        data={rows}
        columns={columns}
        emptyMessage="You have not completed any batches yet."
        // A finished question lives under its subject now, so the row goes there.
        onRowClick={(row) =>
          void navigate(
            ROUTES.evaluator.workSubject
              .replace(':examId', row.examId)
              .replace(':subjectId', row.subjectId),
          )
        }
      />
    </>
  );
}

export default EvaluatorHistoryPage;
