import React from 'react';

import { PageHeader, Panel, StatCard } from '@/components/widgets';
import { Badge } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { ClipboardCheck, ClipboardList, Clock, Flag } from '@/design-system/atoms/icon';
import {
  type BarDatum,
  BreakdownBarChart,
  type DonutSegment,
  DonutStat,
} from '@/design-system/organisms/charts';

/**
 * Evaluator dashboard — PII-safe by design. Markers never see student identity:
 * the work queue is grouped by subject / question / section with script counts
 * only (SafeStudentRef), never names, CNICs or dates of birth.
 * TODO: replace mock data with React Query (evaluator workload endpoints).
 */
const DAILY_MARKING: BarDatum[] = [
  { label: 'Mon', value: 120 },
  { label: 'Tue', value: 142 },
  { label: 'Wed', value: 98 },
  { label: 'Thu', value: 160 },
  { label: 'Fri', value: 138 },
  { label: 'Sat', value: 80 },
  { label: 'Sun', value: 60 },
];

const TODAY_PROGRESS: DonutSegment[] = [
  { label: 'Marked', value: 98, color: 'var(--color-success)' },
  { label: 'Remaining', value: 142, color: 'var(--color-muted-foreground)' },
];

const WORK_QUEUE: {
  subject: string;
  detail: string;
  scripts: number;
  status: string;
  variant: 'warning' | 'default';
}[] = [
  {
    subject: 'Mathematics',
    detail: 'Q4 · Section B',
    scripts: 40,
    status: 'In progress',
    variant: 'warning',
  },
  {
    subject: 'Physics',
    detail: 'Q2 · Section A',
    scripts: 36,
    status: 'Queued',
    variant: 'default',
  },
  {
    subject: 'Chemistry',
    detail: 'Q5 · Section C',
    scripts: 28,
    status: 'Queued',
    variant: 'default',
  },
  {
    subject: 'Biology',
    detail: 'Q1 · Section A',
    scripts: 22,
    status: 'Queued',
    variant: 'default',
  },
];

export function EvaluatorHome(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="My Work"
        subtitle="Mark your assigned answer scripts."
        actions={<Button size="lg">Start Marking</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard dark label="Assigned Today" value="240" icon={ClipboardList} />
        <StatCard
          label="Marked"
          value="98"
          icon={ClipboardCheck}
          delta={18}
          deltaLabel="vs yesterday"
        />
        <StatCard label="Remaining" value="142" icon={Clock} />
        <StatCard label="Flagged" value="5" icon={Flag} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Queue"
          className="lg:col-span-8"
          action={<span className="text-xs text-muted-foreground">No student PII shown</span>}
        >
          <ul className="divide-y divide-border">
            {WORK_QUEUE.map((batch) => (
              <li key={`${batch.subject}-${batch.detail}`} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                  <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{batch.subject}</p>
                  <p className="text-xs text-muted-foreground">{batch.detail}</p>
                </div>
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  {batch.scripts}
                </span>
                <Badge variant={batch.variant}>{batch.status}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Today's Progress" className="lg:col-span-4">
          <DonutStat data={TODAY_PROGRESS} centerValue="41%" centerLabel="Marked" />
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
          <BreakdownBarChart data={DAILY_MARKING} />
        </Panel>

        <div className="flex flex-col rounded-xl bg-brand-gradient p-5 text-white shadow-sm lg:col-span-4">
          <p className="text-sm font-medium text-white/80">Up next</p>
          <p className="mt-1 text-lg font-semibold">Mathematics · Q4</p>
          <p className="text-sm text-white/70">40 scripts remaining in this batch</p>
          <button
            type="button"
            className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-brand transition-colors hover:bg-white/90"
          >
            Continue Marking
          </button>
        </div>
      </div>
    </>
  );
}

export default EvaluatorHome;
