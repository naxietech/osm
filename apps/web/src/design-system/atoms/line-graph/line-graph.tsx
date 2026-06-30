import { type ReactElement, useId } from 'react';

import { cn } from '@/lib/utils';

export interface LineGraphProps {
  /** Points in a 0–100 × 0–100 coordinate space (left→right, top→bottom). */
  points: Array<[number, number]>;
  /** Positioning / sizing classes (the svg is rendered as a block element). */
  className?: string;
  stroke?: string;
  /** Stroke width in CSS pixels (kept constant via non-scaling-stroke). */
  strokeWidth?: number;
  /** When set, a soft gradient area is filled under the line in this colour. */
  areaColor?: string;
}

/**
 * Decorative self-drawing line (with an optional area fill) — an animated chart
 * glyph used as an ambient backdrop. The line + area reveal with a left-to-right
 * wipe, hold, fade and redraw on a loop (CSS, see `styles/graph-glyphs.css`).
 *
 * The svg stretches to fill its box (`preserveAspectRatio="none"`) so it can span
 * any width; the stroke stays crisp via `vector-effect="non-scaling-stroke"`, and
 * the wipe (clip-path) avoids any dependence on path length. Purely cosmetic.
 */
export function LineGraph({
  points,
  className,
  stroke = '#4ade80',
  strokeWidth = 2.4,
  areaColor,
}: LineGraphProps): ReactElement {
  const gradientId = useId();
  const line = points.map(([x, y]) => `${x},${y}`).join(' L');
  const lineD = `M${line}`;
  const first = points[0];
  const last = points[points.length - 1];
  const areaD = first && last ? `${lineD} L${last[0]},100 L${first[0]},100 Z` : '';

  return (
    <svg
      aria-hidden
      className={cn('block', className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {areaColor && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={areaColor} stopOpacity="0.32" />
            <stop offset="1" stopColor={areaColor} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      <g className="glyph-line">
        {areaColor && areaD && <path d={areaD} fill={`url(#${gradientId})`} />}
        <path
          d={lineD}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}

export default LineGraph;
