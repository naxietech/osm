import React from 'react';

import {
  BarChartPlaceholder,
  DonutPlaceholder,
  ItemRow,
  PageHeader,
  Panel,
  PersonRow,
  SkeletonLines,
  StatCard,
} from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';

export function SchoolHome(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="School Dashboard"
        subtitle="Register students and track your school's exams."
        actions={
          <>
            <Button>+ Register Student</Button>
            <Button variant="secondary">Capture</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard dark label="Registered Students" value="1,204" />
        <StatCard label="Sheets Captured" value="3,860" />
        <StatCard label="Pending" value="56" />
        <StatCard label="Results Ready" value="0" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Registration Progress"
          className="lg:col-span-6"
          action={<span className="text-xs text-muted-foreground">This week</span>}
        >
          <BarChartPlaceholder />
        </Panel>
        <Panel title="Exam Schedule" className="lg:col-span-3">
          <ItemRow />
          <ItemRow />
          <ItemRow />
        </Panel>
        <Panel title="Notices" className="lg:col-span-3">
          <SkeletonLines />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Recent Students"
          className="lg:col-span-6"
          action={<span className="text-xs text-brand">View all</span>}
        >
          <PersonRow />
          <PersonRow />
          <PersonRow />
        </Panel>
        <Panel title="Capture Progress" className="lg:col-span-3">
          <DonutPlaceholder value={73} />
        </Panel>
        <Panel title="Results" className="lg:col-span-3">
          <SkeletonLines />
        </Panel>
      </div>
    </>
  );
}

export default SchoolHome;
