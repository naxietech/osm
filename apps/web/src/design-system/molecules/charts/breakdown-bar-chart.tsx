import { type ReactElement } from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BarDatum {
  label: string;
  value: number;
  /** Optional per-bar colour; falls back to the chart `color`. */
  color?: string;
}

export interface BreakdownBarChartProps {
  data: BarDatum[];
  color?: string;
  height?: number;
}

const TOOLTIP_STYLE = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 10px 30px rgb(0 0 0 / 0.08)',
} as const;

/** Themed vertical bar chart for category breakdowns (rounded bars, per-bar colour). */
export function BreakdownBarChart({
  data,
  color = 'var(--color-brand)',
  height = 240,
}: BreakdownBarChartProps): ReactElement {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          width={40}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600, marginBottom: 4 }}
          itemStyle={{ color: 'var(--color-foreground)' }}
          cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((datum) => (
            <Cell key={datum.label} fill={datum.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default BreakdownBarChart;
