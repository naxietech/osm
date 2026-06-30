import { type CSSProperties, type ReactElement } from 'react';

import { cn } from '@/lib/utils';

export interface GaugeRingProps {
  /** Filled fraction of the ring, 0–1. */
  pct?: number;
  /** Positioning / sizing classes (rendered as a block, square element). */
  className?: string;
  stroke?: string;
  trackStroke?: string;
  /** Ring thickness in viewBox units (viewBox is 36×36). */
  strokeWidth?: number;
}

/**
 * Decorative donut gauge — the ring sweeps from empty to `pct`, holds, then resets
 * and repeats (CSS, see `styles/graph-glyphs.css`). The progress path is
 * normalised with `pathLength="1"`, so the resting offset is simply `1 - pct`,
 * passed to CSS via the `--glyph-end` custom property. Ambient/cosmetic.
 */
export function GaugeRing({
  pct = 0.72,
  className,
  stroke = '#34d399',
  trackStroke = 'rgba(110,231,167,0.14)',
  strokeWidth = 3,
}: GaugeRingProps): ReactElement {
  const r = 16;
  const end = Math.min(1, Math.max(0, 1 - pct));

  return (
    <svg aria-hidden className={cn('block', className)} viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke={trackStroke} strokeWidth={strokeWidth} />
      <circle
        className="glyph-ring"
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength={1}
        transform="rotate(-90 18 18)"
        style={{ '--glyph-end': end } as CSSProperties}
      />
    </svg>
  );
}

export default GaugeRing;
