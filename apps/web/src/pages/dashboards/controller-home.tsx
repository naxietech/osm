import React from 'react';

import {
  BarChartPlaceholder,
  DonutPlaceholder,
  ItemRow,
  PageHeader,
  Panel,
  PersonRow,
  StatCard,
} from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';

export function ControllerHome(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="Examiner Overview"
        subtitle="Generate e-sheets, assign questions, and compile results."
        actions={<Button>Marking Scheme</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard dark label="My Subjects" value="3" />
        <StatCard label="Checkers Active" value="14" />
        <StatCard label="Sheets Marked" value="6,402" />
        <StatCard label="Flagged" value="23" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Throughput"
          className="lg:col-span-6"
          action={<span className="text-xs text-muted-foreground">This week</span>}
        >
          <BarChartPlaceholder />
        </Panel>
        <Panel title="Marking Quality" className="lg:col-span-3">
          <DonutPlaceholder value={92} />
        </Panel>
        <Panel
          title="Flagged Queue"
          className="lg:col-span-3"
          action={<span className="text-xs text-brand">Review</span>}
        >
          <ItemRow />
          <ItemRow />
          <ItemRow />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Checkers"
          className="lg:col-span-8"
          action={<span className="text-xs text-brand">Manage</span>}
        >
          <PersonRow />
          <PersonRow />
          <PersonRow />
          <PersonRow />
        </Panel>
        <Panel title="Subject Progress" className="lg:col-span-4">
          <DonutPlaceholder value={58} />
        </Panel>
      </div>
    </>
  );
}

export default ControllerHome;
