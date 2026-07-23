import React from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHeader, Panel, StatCard } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { ClipboardCheck, ClipboardList, Clock, Flag } from '@/design-system/atoms/icon';
import { ProgressBar } from '@/design-system/atoms/progress-bar';
import {
  type BarDatum,
  BreakdownBarChart,
  type DonutSegment,
  DonutStat,
} from '@/design-system/molecules/charts';
import { MarkingBatchStatusBadge } from '@/design-system/molecules/status-badge';
import { useCurrentChecker } from '@/hooks';
import { ROUTES } from '@/router/routes';
import {
  getDailyMarkingCounts,
  getWorkloadSummary,
  listOpenBatches,
  nextAnswerInSubject,
  nextBatch,
} from '@/services/marking.service';

/**
 * Checker dashboard — PII-safe by design. Markers never see student identity: the work
 * queue is grouped by subject and question with script counts only, never names, CNICs
 * or dates of birth. One batch is one question, so a checker never holds a whole paper.
 *
 * Every number here is derived from marking.service rather than written into the page,
 * so the dashboard, the queue and the batch pages can never disagree with each other.
 */
export function EvaluatorHome(): React.ReactElement {
  const navigate = useNavigate();
  const checker = useCurrentChecker();

  const summary = getWorkloadSummary(checker?.id ?? '');
  const openBatches = checker ? listOpenBatches(checker.id) : [];
  const upNext = checker ? nextBatch(checker.id) : undefined;
  const daily = checker ? getDailyMarkingCounts(checker.id) : [];

  const pace: BarDatum[] = daily.map((day) => ({ label: day.label, value: day.count }));
  const progress: DonutSegment[] = [
    { label: 'Marked', value: summary.marked, color: 'var(--color-success)' },
    { label: 'Remaining', value: summary.remaining, color: 'var(--color-muted-foreground)' },
  ];

  /** A queue row opens the subject it belongs to, where its answers are listed. */
  const goToSubject = (examId: string, subjectId: string): void =>
    void navigate(
      ROUTES.evaluator.workSubject.replace(':examId', examId).replace(':subjectId', subjectId),
    );

  /**
   * The two "marking" calls to action jump straight to the next answer needing a mark.
   * If that subject has nothing pending, they fall back to its answer list.
   */
  const startMarking = (examId: string, subjectId: string): void => {
    const next = checker ? nextAnswerInSubject(checker.id, examId, subjectId) : undefined;
    if (!next) {
      goToSubject(examId, subjectId);
      return;
    }
    void navigate(
      ROUTES.evaluator.markAnswer
        .replace(':examId', examId)
        .replace(':subjectId', subjectId)
        .replace(':scriptId', next.id),
    );
  };

  return (
    <>
      <PageHeader
        title="My Work"
        subtitle="Mark your assigned answer scripts."
        actions={
          <Button
            size="lg"
            disabled={!upNext}
            onClick={() => upNext && startMarking(upNext.examId, upNext.subjectId)}
          >
            Start Marking
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          dark
          label="Assigned"
          value={String(summary.assignedTotal)}
          icon={ClipboardList}
        />
        <StatCard label="Marked" value={String(summary.marked)} icon={ClipboardCheck} />
        <StatCard label="Remaining" value={String(summary.remaining)} icon={Clock} />
        <StatCard label="Flagged" value={String(summary.flagged)} icon={Flag} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Queue"
          className="lg:col-span-8"
          action={<span className="text-xs text-muted-foreground">No student PII shown</span>}
        >
          {openBatches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing assigned to you right now.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {openBatches.map((batch) => (
                <li key={batch.id}>
                  <button
                    type="button"
                    onClick={() => goToSubject(batch.examId, batch.subjectId)}
                    className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                      <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {batch.subject}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {batch.scopeLabel}
                      </span>
                    </span>
                    <span className="hidden w-32 sm:block">
                      <ProgressBar
                        value={batch.progressPercent}
                        label={`${batch.subject} ${batch.scopeLabel} marking progress`}
                      />
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {batch.markedScripts}/{batch.totalScripts}
                    </span>
                    <MarkingBatchStatusBadge status={batch.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Overall Progress" className="lg:col-span-4">
          <DonutStat
            data={progress}
            centerValue={`${summary.progressPercent}%`}
            centerLabel="Marked"
          />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Pace"
          className="lg:col-span-8"
          action={
            <span className="text-xs text-muted-foreground">Scripts per day · this week</span>
          }
        >
          <BreakdownBarChart data={pace} />
        </Panel>

        <div className="flex flex-col rounded-xl bg-brand-gradient p-5 text-white shadow-sm lg:col-span-4">
          <p className="text-sm font-medium text-white/80">Up next</p>
          {upNext ? (
            <>
              <p className="mt-1 text-lg font-semibold">
                {upNext.subject} · {upNext.scopeLabel}
              </p>
              <p className="text-sm text-white/70">
                {upNext.pendingScripts} script{upNext.pendingScripts === 1 ? '' : 's'} remaining in
                this batch
              </p>
              <button
                type="button"
                onClick={() => startMarking(upNext.examId, upNext.subjectId)}
                className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-brand transition-colors hover:bg-white/90"
              >
                Continue Marking
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-lg font-semibold">All caught up</p>
              <p className="text-sm text-white/70">
                You have marked {summary.markedToday} script
                {summary.markedToday === 1 ? '' : 's'} today.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default EvaluatorHome;
