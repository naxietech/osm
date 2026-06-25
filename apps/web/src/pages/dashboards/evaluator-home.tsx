import React from 'react';

import {
  BarChartPlaceholder,
  DarkCard,
  DonutPlaceholder,
  ItemRow,
  PageHeader,
  Panel,
  StatCard,
} from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';

export function EvaluatorHome(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="My Work"
        subtitle="Mark your assigned question batches."
        actions={<Button size="lg">Start Marking</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard dark label="Assigned Today" value="240" />
        <StatCard label="Marked" value="98" />
        <StatCard label="Remaining" value="142" />
        <StatCard label="Flagged" value="5" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Queue"
          className="lg:col-span-8"
          action={<span className="text-xs text-muted-foreground">Q4 · Mathematics</span>}
        >
          <ItemRow />
          <ItemRow />
          <ItemRow />
          <ItemRow />
        </Panel>
        <Panel title="Today's Progress" className="lg:col-span-4">
          <DonutPlaceholder value={41} />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Marking Pace"
          className="lg:col-span-8"
          action={<span className="text-xs text-muted-foreground">This week</span>}
        >
          <BarChartPlaceholder />
        </Panel>
        <DarkCard className="lg:col-span-4">
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

export default EvaluatorHome;
