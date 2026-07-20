import { type ReactElement } from 'react';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface DonutSegment {
  label: string;
  value: number;
  /** Segment colour — pass a theme token, e.g. 'var(--color-success)'. */
  color: string;
}

export interface DonutStatProps {
  data: DonutSegment[];
  height?: number;
  /** Large value shown in the donut hole (e.g. a total or percentage). */
  centerValue?: string;
  /** Caption under the center value. */
  centerLabel?: string;
}

const TOOLTIP_STYLE = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 10px 30px rgb(0 0 0 / 0.08)',
} as const;

/** Themed donut with an optional centered value/label and a wrapping legend. */
export function DonutStat({
  data,
  height = 220,
  centerValue,
  centerLabel,
}: DonutStatProps): ReactElement {
  return (
    <div>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((segment) => (
                <Cell key={segment.label} fill={segment.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={{ color: 'var(--color-foreground)' }}
            />
          </PieChart>
        </ResponsiveContainer>

        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <span className="text-2xl font-semibold text-foreground">{centerValue}</span>
            )}
            {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((segment) => (
          <span
            key={segment.label}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: segment.color }}
              aria-hidden
            />
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default DonutStat;
