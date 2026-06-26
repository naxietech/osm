import React from 'react';

import { PageHeader, Panel, StatCard } from '@/components/widgets';
import { Badge } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { ClipboardList, Clock, FileSpreadsheet, FileText, Plus } from '@/design-system/atoms/icon';
import {
  type BarDatum,
  BreakdownBarChart,
  type DonutSegment,
  DonutStat,
  TrendAreaChart,
  type TrendPoint,
} from '@/design-system/organisms/charts';

// TODO: replace mock data with React Query (exam-ops endpoints).
const THROUGHPUT: TrendPoint[] = [
  { label: 'Mon', value: 1200 },
  { label: 'Tue', value: 1480 },
  { label: 'Wed', value: 1320 },
  { label: 'Thu', value: 1760 },
  { label: 'Fri', value: 1610 },
  { label: 'Sat', value: 980 },
  { label: 'Sun', value: 740 },
];

const PIPELINE: DonutSegment[] = [
  { label: 'Compiled', value: 18, color: 'var(--color-success)' },
  { label: 'In Progress', value: 9, color: 'var(--color-warning)' },
  { label: 'Not Started', value: 5, color: 'var(--color-muted-foreground)' },
];

const PAPER_PROGRESS: BarDatum[] = [
  { label: 'Math', value: 86 },
  { label: 'Physics', value: 72 },
  { label: 'Chem', value: 64 },
  { label: 'Bio', value: 58 },
  { label: 'English', value: 80 },
];

const AWAITING: {
  subject: string;
  code: string;
  status: string;
  variant: 'success' | 'warning' | 'default';
}[] = [
  { subject: 'Mathematics · Paper II', code: 'MTH-202', status: 'Ready', variant: 'success' },
  { subject: 'Physics · Paper I', code: 'PHY-101', status: 'In Review', variant: 'warning' },
  { subject: 'Chemistry · Paper II', code: 'CHM-202', status: 'Marking', variant: 'default' },
  { subject: 'Biology · Paper I', code: 'BIO-101', status: 'Ready', variant: 'success' },
];

const compact = (value: number): string => `${(value / 1000).toFixed(1)}k`;

export function ControllerHome(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="Examiner Dashboard"
        subtitle="Track e-sheets, marking and result compilation."
        actions={
          <Button>
            <Plus className="h-4 w-4" aria-hidden />
            New Template
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          dark
          label="Active Exams"
          value="7"
          icon={FileSpreadsheet}
          delta={2}
          deltaLabel="this month"
        />
        <StatCard label="E-Sheet Templates" value="24" icon={FileText} delta={3} />
        <StatCard label="Questions Assigned" value="1,860" icon={ClipboardList} delta={8} />
        <StatCard label="Pending Compilation" value="12" icon={Clock} delta={-4} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Throughput"
          className="lg:col-span-8"
          action={<span className="text-xs text-muted-foreground">This week</span>}
        >
          <TrendAreaChart data={THROUGHPUT} valueFormatter={compact} />
        </Panel>
        <Panel title="Compilation Pipeline" className="lg:col-span-4">
          <DonutStat data={PIPELINE} centerValue="32" centerLabel="Papers" />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Progress by Paper"
          className="lg:col-span-7"
          action={<span className="text-xs text-muted-foreground">% complete</span>}
        >
          <BreakdownBarChart data={PAPER_PROGRESS} />
        </Panel>
        <Panel
          title="Awaiting Compilation"
          className="lg:col-span-5"
          action={<span className="cursor-pointer text-xs text-brand">View all</span>}
        >
          <ul className="divide-y divide-border">
            {AWAITING.map((paper) => (
              <li key={paper.code} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                  <FileSpreadsheet className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{paper.subject}</p>
                  <p className="text-xs text-muted-foreground">{paper.code}</p>
                </div>
                <Badge variant={paper.variant}>{paper.status}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

export default ControllerHome;
