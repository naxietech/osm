import { type ReactElement, useId } from 'react';

import { cn } from '@/lib/utils';

export interface BarGraphProps {
  /** Bar heights as a percentage (0–100) of the chart height, left→right. */
  heights: number[];
  /** Positioning / sizing classes (the svg is rendered as a block element). */
  className?: string;
  /** Top→bottom gradient colours for the bars. */
  fromColor?: string;
  toColor?: string;
}

/**
 * Decorative bar chart — the bars grow up from the baseline in a staggered sweep,
 * hold, then collapse and repeat (CSS, see `styles/graph-glyphs.css`). Ambient and
 * purely cosmetic (aria-hidden). Sizing/position is supplied via `className`.
 */
export function BarGraph({
  heights,
  className,
  fromColor = '#4ade80',
  toColor = '#157f43',
}: BarGraphProps): ReactElement {
  const gradientId = useId();
  const n = heights.length;
  const slot = 100 / n; // each bar gets an equal column
  const barWidth = slot * 0.55;
  const pad = (slot - barWidth) / 2;

  return (
    <svg
      aria-hidden
      className={cn('block', className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fromColor} />
          <stop offset="1" stopColor={toColor} />
        </linearGradient>
      </defs>
      {heights.map((h, i) => (
        <rect
          // eslint-disable-next-line react/no-array-index-key -- decorative, fixed-order bars
          key={i}
          className="glyph-bar"
          x={i * slot + pad}
          y={100 - h}
          width={barWidth}
          height={h}
          rx={1.5}
          fill={`url(#${gradientId})`}
          style={{ animationDelay: `${(i * 0.12).toFixed(2)}s` }}
        />
      ))}
    </svg>
  );
}

export default BarGraph;
