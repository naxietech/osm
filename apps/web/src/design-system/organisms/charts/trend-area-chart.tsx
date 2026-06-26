import { type ReactElement, useId } from 'react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendAreaChartProps {
  data: TrendPoint[];
  /** Line / fill colour. Defaults to the brand token (theme + dark-mode aware). */
  color?: string;
  height?: number;
  /** Format Y-axis ticks (e.g. compact "48.9k"). */
  valueFormatter?: (value: number) => string;
}

const TOOLTIP_STYLE = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 10px 30px rgb(0 0 0 / 0.08)',
} as const;

/** Themed area chart for time-series trends, with a soft brand-gradient fill. */
export function TrendAreaChart({
  data,
  color = 'var(--color-brand)',
  height = 240,
  valueFormatter,
}: TrendAreaChartProps): ReactElement {
  const gradientId = `trend-grad-${useId().replace(/:/g, '')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
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
          tickFormatter={valueFormatter}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600, marginBottom: 4 }}
          itemStyle={{ color: 'var(--color-foreground)' }}
          cursor={{ stroke: 'var(--color-border)' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default TrendAreaChart;
