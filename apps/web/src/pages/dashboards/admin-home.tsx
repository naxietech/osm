import React from 'react';

import {
  BarChartPlaceholder,
  DarkCard,
  DonutPlaceholder,
  ItemRow,
  PageHeader,
  Panel,
  PersonRow,
  StatCard,
} from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';

export function AdminHome(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Board overview across schools, exams and marking."
        actions={
          <>
            <Button>+ New Exam</Button>
            <Button variant="secondary">Import</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard dark label="Schools" value="312" />
        <StatCard label="Active Exams" value="7" />
        <StatCard label="Sheets Scanned" value="48,920" />
        <StatCard label="Pending Reviews" value="142" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Analytics"
          className="lg:col-span-6"
          action={<span className="text-xs text-muted-foreground">This week</span>}
        >
          <BarChartPlaceholder />
        </Panel>
        <Panel title="Reminders" className="lg:col-span-3">
          <div className="space-y-3">
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="h-2 w-28 rounded bg-muted/60" />
            <Button size="sm" className="mt-2 w-full">
              Start session
            </Button>
          </div>
        </Panel>
        <Panel
          title="Recent Schools"
          className="lg:col-span-3"
          action={<span className="text-xs text-brand">+ New</span>}
        >
          <ItemRow />
          <ItemRow />
          <ItemRow />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Examiners"
          className="lg:col-span-6"
          action={<span className="text-xs text-brand">Manage</span>}
        >
          <PersonRow />
          <PersonRow />
          <PersonRow />
        </Panel>
        <Panel title="Marking Progress" className="lg:col-span-3">
          <DonutPlaceholder value={41} />
        </Panel>
        <DarkCard className="lg:col-span-3">
          <div className="h-3 w-24 rounded bg-white/30" />
          <p className="mt-6 text-center text-4xl font-semibold tabular-nums">01:24:08</p>
          <div className="mt-6 flex justify-center gap-3">
            <span className="h-9 w-9 rounded-full bg-white/15" />
            <span className="h-9 w-9 rounded-full bg-white/15" />
          </div>
        </DarkCard>
      </div>
    </>
  );
}

export default AdminHome;
