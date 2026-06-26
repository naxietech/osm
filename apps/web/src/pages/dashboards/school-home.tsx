import React from 'react';

import { PageHeader, Panel, StatCard } from '@/components/widgets';
import { Badge } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { BarChart3, Calendar, ClipboardCheck, Plus, Users } from '@/design-system/atoms/icon';
import {
  type BarDatum,
  BreakdownBarChart,
  type DonutSegment,
  DonutStat,
} from '@/design-system/organisms/charts';

// TODO: replace mock data with React Query (this school's students + results).
const STUDENTS_BY_GRADE: BarDatum[] = [
  { label: 'Grade 9', value: 342 },
  { label: 'Grade 10', value: 318 },
  { label: 'Grade 11', value: 326 },
  { label: 'Grade 12', value: 298 },
];

const ENROLLMENT_STATUS: DonutSegment[] = [
  { label: 'Active', value: 1190, color: 'var(--color-success)' },
  { label: 'Transferred', value: 28, color: 'var(--color-warning)' },
  { label: 'Graduated', value: 20, color: 'var(--color-info)' },
  { label: 'Inactive', value: 46, color: 'var(--color-muted-foreground)' },
];

const RECENT_STUDENTS: {
  name: string;
  grade: string;
  status: string;
  variant: 'success' | 'default';
}[] = [
  { name: 'Ali Hassan', grade: 'Grade 10 · A', status: 'Active', variant: 'success' },
  { name: 'Fatima Noor', grade: 'Grade 12 · B', status: 'Active', variant: 'success' },
  { name: 'Bilal Ahmed', grade: 'Grade 9 · C', status: 'Inactive', variant: 'default' },
  { name: 'Hina Shah', grade: 'Grade 11 · A', status: 'Active', variant: 'success' },
];

const DEADLINES: { title: string; date: string }[] = [
  { title: 'HSSC registration closes', date: '30 Jun' },
  { title: 'Photo upload deadline', date: '05 Jul' },
  { title: 'Exam fee submission', date: '12 Jul' },
];

const initialsOf = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function SchoolHome(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="School Dashboard"
        subtitle="Manage your students and track exam registration."
        actions={
          <Button>
            <Plus className="h-4 w-4" aria-hidden />
            Add Student
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard dark label="Total Students" value="1,284" icon={Users} delta={6} />
        <StatCard label="Active" value="1,190" icon={ClipboardCheck} delta={3} />
        <StatCard label="Registered for Exam" value="940" icon={Calendar} delta={11} />
        <StatCard
          label="Results Available"
          value="312"
          icon={BarChart3}
          delta={24}
          deltaLabel="this term"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Students by Grade"
          className="lg:col-span-7"
          action={<span className="text-xs text-muted-foreground">Current session</span>}
        >
          <BreakdownBarChart data={STUDENTS_BY_GRADE} />
        </Panel>
        <Panel title="Enrollment Status" className="lg:col-span-5">
          <DonutStat data={ENROLLMENT_STATUS} centerValue="1,284" centerLabel="Students" />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Recently Added Students"
          className="lg:col-span-8"
          action={<span className="cursor-pointer text-xs text-brand">View all</span>}
        >
          <ul className="divide-y divide-border">
            {RECENT_STUDENTS.map((student) => (
              <li key={student.name} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
                  {initialsOf(student.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.grade}</p>
                </div>
                <Badge variant={student.variant}>{student.status}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Upcoming Deadlines" className="lg:col-span-4">
          <ul className="divide-y divide-border">
            {DEADLINES.map((deadline) => (
              <li key={deadline.title} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                  <Calendar className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{deadline.title}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {deadline.date}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

export default SchoolHome;
