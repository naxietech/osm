import React from 'react';

import { PageHeader, Panel, StatCard } from '@/components/widgets';
import { Badge } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import {
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  Plus,
  Users,
} from '@/design-system/atoms/icon';
import {
  type BarDatum,
  BreakdownBarChart,
  type DonutSegment,
  DonutStat,
  TrendAreaChart,
  type TrendPoint,
} from '@/design-system/organisms/charts';

// TODO: replace mock data with React Query (board analytics endpoints).
const MARKING_TREND: TrendPoint[] = [
  { label: 'Mon', value: 5200 },
  { label: 'Tue', value: 6100 },
  { label: 'Wed', value: 5800 },
  { label: 'Thu', value: 7200 },
  { label: 'Fri', value: 6900 },
  { label: 'Sat', value: 4300 },
  { label: 'Sun', value: 3800 },
];

const SUBJECT_PROGRESS: BarDatum[] = [
  { label: 'Math', value: 82 },
  { label: 'Physics', value: 74 },
  { label: 'Chem', value: 88 },
  { label: 'Bio', value: 69 },
  { label: 'English', value: 91 },
  { label: 'Urdu', value: 78 },
];

const SCHOOL_STATUS: DonutSegment[] = [
  { label: 'Complete', value: 248, color: 'var(--color-success)' },
  { label: 'Onboarding', value: 41, color: 'var(--color-warning)' },
  { label: 'Pending', value: 23, color: 'var(--color-muted-foreground)' },
];

const RECENT_SCHOOLS: {
  name: string;
  city: string;
  status: string;
  variant: 'success' | 'warning' | 'default';
}[] = [
  { name: 'Govt High School Gulberg', city: 'Lahore', status: 'Active', variant: 'success' },
  { name: 'Federal Govt School F-8', city: 'Islamabad', status: 'Onboarding', variant: 'warning' },
  { name: 'Govt Boys Secondary Clifton', city: 'Karachi', status: 'Active', variant: 'success' },
  { name: 'Cadet College Hasan Abdal', city: 'Attock', status: 'Pending', variant: 'default' },
];

const TOP_EVALUATORS: { name: string; subject: string; marked: number }[] = [
  { name: 'Ayesha Khan', subject: 'Mathematics', marked: 1284 },
  { name: 'Bilal Ahmed', subject: 'Physics', marked: 1147 },
  { name: 'Sana Tariq', subject: 'Chemistry', marked: 1098 },
  { name: 'Usman Ali', subject: 'English', marked: 1042 },
];

const compact = (value: number): string => `${(value / 1000).toFixed(1)}k`;

export function AdminHome(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Board overview across schools, exams and marking."
        actions={
          <>
            <Button>
              <Plus className="h-4 w-4" aria-hidden />
              New Exam
            </Button>
            <Button variant="secondary">Import</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard dark label="Registered Schools" value="312" icon={Building2} delta={4} />
        <StatCard label="Enrolled Students" value="48,920" icon={Users} delta={12} />
        <StatCard
          label="Active Exams"
          value="7"
          icon={FileSpreadsheet}
          delta={2}
          deltaLabel="this month"
        />
        <StatCard label="Papers Marked Today" value="6,418" icon={ClipboardCheck} delta={-3} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Throughput"
          className="lg:col-span-8"
          action={<span className="text-xs text-muted-foreground">This week</span>}
        >
          <TrendAreaChart data={MARKING_TREND} valueFormatter={compact} />
        </Panel>
        <Panel title="School Onboarding" className="lg:col-span-4">
          <DonutStat data={SCHOOL_STATUS} centerValue="312" centerLabel="Schools" />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Subject-wise Marking Progress"
          className="lg:col-span-7"
          action={<span className="text-xs text-muted-foreground">% complete</span>}
        >
          <BreakdownBarChart data={SUBJECT_PROGRESS} />
        </Panel>
        <Panel
          title="Recent Schools"
          className="lg:col-span-5"
          action={<span className="cursor-pointer text-xs text-brand">View all</span>}
        >
          <ul className="divide-y divide-border">
            {RECENT_SCHOOLS.map((school) => (
              <li key={school.name} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                  <Building2 className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{school.name}</p>
                  <p className="text-xs text-muted-foreground">{school.city}</p>
                </div>
                <Badge variant={school.variant}>{school.status}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Top Evaluators"
        className="mt-4"
        action={<span className="text-xs text-muted-foreground">Papers marked · this exam</span>}
      >
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {TOP_EVALUATORS.map((evaluator, index) => (
            <li
              key={evaluator.name}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
            >
              <span className={cnRank(index)}>{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{evaluator.name}</p>
                <p className="text-xs text-muted-foreground">{evaluator.subject}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {evaluator.marked.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

/** Rank badge classes — the leader gets the brand accent. */
function cnRank(index: number): string {
  return [
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
    index === 0 ? 'bg-brand text-white' : 'bg-muted text-muted-foreground',
  ].join(' ');
}

export default AdminHome;
