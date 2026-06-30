import { type ReactElement } from 'react';

import { BarGraph } from '@/design-system/atoms/bar-graph';
import { CheckMark } from '@/design-system/atoms/check-mark';
import { GaugeRing } from '@/design-system/atoms/gauge-ring';
import { LineGraph } from '@/design-system/atoms/line-graph';

/**
 * Full-page animated analytics backdrop for the login screen. Composes the
 * decorative chart atoms — a self-drawing line + area along the bottom, a growing
 * bar chart and a filling gauge in the top corners, and a few self-drawing check
 * marks — over a faint OSES watermark.
 *
 * Layout and responsiveness are pure CSS: each atom is absolutely positioned with
 * percentage offsets so nothing is ever cropped, and a couple of accents are
 * hidden on narrow screens (`hidden sm:block`). All motion is CSS and stops under
 * `prefers-reduced-motion`. Decorative only: aria-hidden + non-interactive.
 */
export function LoginBackground(): ReactElement {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* line + area sweeping along the bottom */}
      <LineGraph
        className="absolute inset-x-0 bottom-[6%] h-[34%] w-full"
        points={[
          [3, 78],
          [18, 55],
          [33, 64],
          [48, 38],
          [63, 48],
          [78, 26],
          [97, 32],
        ]}
        stroke="#4ade80"
        strokeWidth={2.4}
        areaColor="#34d399"
      />

      {/* bar chart, top-left */}
      <BarGraph
        className="absolute left-[7%] top-[14%] h-[20%] w-[28%] sm:w-[22%]"
        heights={[42, 62, 34, 70, 50, 82, 58]}
      />

      {/* gauge, top-right */}
      <GaugeRing
        className="absolute right-[8%] top-[13%] aspect-square w-[18vw] max-w-[120px]"
        pct={0.72}
      />

      {/* check marks */}
      <CheckMark className="absolute left-[12%] top-[50%] h-9 w-9" delay={300} />
      <CheckMark className="absolute right-[9%] top-[58%] hidden h-7 w-7 sm:block" delay={900} />
      <CheckMark className="absolute left-[34%] top-[16%] hidden h-6 w-6 sm:block" delay={1500} />
      <CheckMark className="absolute bottom-[12%] right-[28%] h-10 w-10" delay={600} />

      {/* faint OSES watermark */}
      <div className="absolute inset-0 grid place-items-center opacity-[0.045]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2bc79a"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 'min(62vw, 560px)', height: 'min(62vw, 560px)' }}
        >
          <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
          <path d="M22 10v6" />
          <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
        </svg>
      </div>
    </div>
  );
}

export default LoginBackground;
