import { type ReactElement } from 'react';

import { cn } from '@/lib/utils';

export interface CheckMarkProps {
  /** Positioning / sizing classes (rendered as a block, square element). */
  className?: string;
  /** Delay before the check draws itself, in milliseconds. */
  delay?: number;
  stroke?: string;
}

/**
 * Decorative check mark that draws itself once (after `delay`) and then gently
 * floats (CSS, see `styles/graph-glyphs.css`). Stroke is normalised with
 * `pathLength="1"`. Ambient/cosmetic (aria-hidden).
 */
export function CheckMark({
  className,
  delay = 0,
  stroke = '#34d399',
}: CheckMarkProps): ReactElement {
  return (
    <svg aria-hidden className={cn('block', className)} viewBox="0 0 24 24">
      <g className="glyph-float">
        <path
          className="glyph-check"
          d="M20 6 9 17l-5-5"
          pathLength={1}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animationDelay: `${delay}ms` }}
        />
      </g>
    </svg>
  );
}

export default CheckMark;
