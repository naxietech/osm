/**
 * My Work → exam → subject: the answers this checker has to mark for that subject.
 *
 * Last step before marking. A subject can span several questions, so each row says which
 * question it belongs to; answers still to mark are listed first. Clicking one opens it
 * to check and annotate.
 *
 * Every row is anonymous — an opaque reference and a question number, nothing about the
 * person who wrote it.
 */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { type MarkingAnswerListItem } from '@oses/types';

import { PageHeader, Panel } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { ChevronLeft } from '@/design-system/atoms/icon';
import { ProgressBar } from '@/design-system/atoms/progress-bar';
import { MarkingBandBadge, MarkingScriptStatusBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { useCurrentChecker } from '@/hooks';
import { ROUTES } from '@/router/routes';
import {
  listCheckerAnswers,
  listCheckerSubjects,
  nextAnswerInSubject,
} from '@/services/marking.service';

const columns: ColumnDef<MarkingAnswerListItem>[] = [
  {
    key: 'questionLabel',
    header: 'Question',
    render: (row) => <span className="font-medium text-foreground">{row.questionLabel}</span>,
    width: '110px',
  },
  {
    key: 'candidateRefId',
    header: 'Answer',
    render: (row) => <span className="font-mono text-xs">{row.candidateRefId}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <MarkingScriptStatusBadge status={row.status} />,
    width: '120px',
  },
  {
    key: 'band',
    header: 'Band',
    render: (row) =>
      row.band ? (
        <MarkingBandBadge band={row.band} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    width: '180px',
  },
  {
    key: 'awardedMarks',
    header: 'Marks',
    render: (row) =>
      row.awardedMarks === undefined ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="font-medium tabular-nums">
          {row.awardedMarks}
          <span className="text-muted-foreground"> / {row.maxMarks}</span>
        </span>
      ),
    width: '110px',
  },
];

export function EvaluatorSubjectPage(): React.ReactElement {
  const navigate = useNavigate();
  const { examId = '', subjectId = '' } = useParams<{ examId: string; subjectId: string }>();
  const checker = useCurrentChecker();

  const subject = checker
    ? listCheckerSubjects(checker.id, examId).find((s) => s.subjectId === subjectId)
    : undefined;
  const answers = checker ? listCheckerAnswers(checker.id, examId, subjectId) : [];
  const examPath = ROUTES.evaluator.workExam.replace(':examId', examId);

  const openAnswer = (scriptId: string): void =>
    void navigate(
      ROUTES.evaluator.markAnswer
        .replace(':examId', examId)
        .replace(':subjectId', subjectId)
        .replace(':scriptId', scriptId),
    );

  // Not the checker's subject — refused for the same reason a foreign batch is.
  if (!subject) {
    return (
      <>
        <PageHeader
          title="Subject not found"
          subtitle="You have no work assigned in this subject"
        />
        <Button variant="ghost" onClick={() => void navigate(examPath)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Go back
        </Button>
      </>
    );
  }

  const next = checker ? nextAnswerInSubject(checker.id, examId, subjectId) : undefined;

  return (
    <>
      <PageHeader
        title={subject.subject}
        subtitle={`${subject.questionCount} question${subject.questionCount === 1 ? '' : 's'} · ${subject.totalScripts} answers assigned to you`}
        actions={
          <>
            <Button variant="ghost" onClick={() => void navigate(examPath)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
            <Button variant="primary" disabled={!next} onClick={() => next && openAnswer(next.id)}>
              Start marking
            </Button>
          </>
        }
      />

      <Panel title="Progress" className="mb-4">
        <ProgressBar
          value={subject.progressPercent}
          label={`${subject.subject} marking progress`}
          showValue
        />
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{subject.markedScripts}</span> marked
          {' · '}
          <span className="font-medium text-foreground">{subject.pendingScripts}</span> to mark
          {' · '}
          <span className="font-medium text-foreground">{subject.flaggedScripts}</span> flagged
        </p>
      </Panel>

      <Panel
        title="Answers"
        action={
          <span className="text-xs text-muted-foreground">
            Anonymous references — no candidate identity is shown
          </span>
        }
      >
        <DataTable
          data={answers}
          columns={columns}
          emptyMessage="No answers assigned to you for this subject."
          onRowClick={(row) => openAnswer(row.id)}
        />
      </Panel>
    </>
  );
}

export default EvaluatorSubjectPage;
