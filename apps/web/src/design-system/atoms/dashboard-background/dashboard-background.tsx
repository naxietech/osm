import React, { useEffect, useRef } from 'react';

/**
 * Full-page animated "exam dashboard" backdrop for the auth screen: a single
 * self-drawing line + area chart, a growing bar chart, a filling donut gauge and
 * a few self-drawing check marks — all in brand green, looping gently behind the
 * login card.
 *
 * It draws in real pixel coordinates sized to the live viewport (the SVG viewBox
 * is set to window width/height) and rebuilds on resize, so nothing is cropped
 * off-screen — it is responsive on phones too, with a lighter layout under 600px.
 *
 * Motion uses the Web Animations API. It is skipped entirely when the user asks
 * for reduced motion or when WAAPI is unavailable (e.g. jsdom in tests), in which
 * case the shapes render statically. Decorative only: aria-hidden + non-interactive.
 */

const SVGNS = 'http://www.w3.org/2000/svg';

type Pt = [number, number];

interface LineOpt {
  stroke: string;
  w?: number;
  r?: number;
  dot?: string;
  areaFill?: string;
  areaBottom?: number;
  delay?: number;
}
interface BarOpt {
  w?: number;
  gap?: number;
  fill?: string;
  delay?: number;
}
interface DonutOpt {
  w?: number;
  pct?: number;
  stroke?: string;
  delay?: number;
}

export function DashboardBackground(): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg: SVGSVGElement | null = svgRef.current;
    if (!svg) return;
    const svgEl: SVGSVGElement = svg;

    const reduce =
      Boolean(window.matchMedia) && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isJsdom =
      typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom');
    const canAnimate = !reduce && !isJsdom && typeof Element.prototype.animate === 'function';
    const DUR = 7600;
    let layer: SVGGElement | null = null;

    const el = (name: string, attrs: Record<string, string | number>): SVGElement => {
      const e = document.createElementNS(SVGNS, name);
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v !== undefined) e.setAttribute(k, String(v));
      });
      return e;
    };

    /* ---- one line + area + data points ---- */
    function lineChart(pts: Pt[], opt: LineOpt): void {
      const lyr = layer;
      if (!lyr) return;
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (!first || !last) return;
      const d = 'M' + pts.map((p) => `${p[0]},${p[1]}`).join(' L');
      let area: SVGElement | null = null;
      if (opt.areaFill && opt.areaBottom !== undefined) {
        const ad = `${d} L${last[0]},${opt.areaBottom} L${first[0]},${opt.areaBottom} Z`;
        area = el('path', { d: ad, fill: opt.areaFill });
        area.style.opacity = '0';
        lyr.appendChild(area);
      }
      const line = el('path', {
        d,
        fill: 'none',
        stroke: opt.stroke,
        'stroke-width': opt.w ?? 2.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      line.setAttribute('class', 'rline');
      lyr.appendChild(line);
      const dots = pts.map((p) => {
        const c = el('circle', { cx: p[0], cy: p[1], r: opt.r ?? 4, fill: opt.dot ?? '#9af3c0' });
        c.setAttribute('class', 'rdot');
        c.style.opacity = '0';
        lyr.appendChild(c);
        return c;
      });

      if (!canAnimate) {
        line.style.opacity = '0.6';
        if (area) area.style.opacity = '0.26';
        dots.forEach((c) => {
          c.style.opacity = '0.85';
        });
        return;
      }

      const L = (line as SVGGeometryElement).getTotalLength();
      line.style.strokeDasharray = String(L);
      line.style.strokeDashoffset = String(L);
      line.animate(
        [
          { strokeDashoffset: L, opacity: 0, offset: 0 },
          { opacity: 0.6, offset: 0.05 },
          { strokeDashoffset: 0, opacity: 0.6, offset: 0.45 },
          { strokeDashoffset: 0, opacity: 0.6, offset: 0.82 },
          { strokeDashoffset: 0, opacity: 0, offset: 0.98 },
          { strokeDashoffset: L, opacity: 0, offset: 1 },
        ],
        { duration: DUR, iterations: Infinity, delay: opt.delay ?? 0, easing: 'ease-in-out' },
      );
      if (area)
        area.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: 0.45 },
            { opacity: 0.26, offset: 0.62 },
            { opacity: 0.26, offset: 0.82 },
            { opacity: 0, offset: 0.98 },
            { opacity: 0, offset: 1 },
          ],
          { duration: DUR, iterations: Infinity, delay: opt.delay ?? 0, easing: 'ease-in-out' },
        );
      const n = dots.length;
      dots.forEach((c, i) => {
        const ap = 0.05 + (n > 1 ? i / (n - 1) : 0) * 0.4;
        c.animate(
          [
            { opacity: 0, transform: 'scale(0.3)', offset: 0 },
            { opacity: 0, transform: 'scale(0.3)', offset: Math.max(0, ap - 0.03) },
            { opacity: 0.9, transform: 'scale(1)', offset: Math.min(0.99, ap + 0.02) },
            { opacity: 0.9, transform: 'scale(1)', offset: 0.82 },
            { opacity: 0, transform: 'scale(0.6)', offset: 0.96 },
            { opacity: 0, transform: 'scale(0.3)', offset: 1 },
          ],
          { duration: DUR, iterations: Infinity, delay: opt.delay ?? 0, easing: 'ease-out' },
        );
      });
    }

    /* ---- bar chart (bars grow up) ---- */
    function barChart(x0: number, baseline: number, heights: number[], opt: BarOpt): void {
      const lyr = layer;
      if (!lyr) return;
      const bw = opt.w ?? 22;
      const gap = opt.gap ?? 16;
      const n = heights.length;
      heights.forEach((h, i) => {
        const r = el('rect', {
          x: x0 + i * (bw + gap),
          y: baseline - h,
          width: bw,
          height: h,
          rx: 4,
          fill: opt.fill ?? 'url(#oses-bar)',
        });
        r.setAttribute('class', 'rbar');
        r.style.opacity = '0';
        lyr.appendChild(r);
        const ap = 0.06 + (n > 1 ? i / (n - 1) : 0) * 0.3;
        if (!canAnimate) {
          r.style.opacity = '0.5';
          return;
        }
        r.style.transform = 'scaleY(0)';
        r.animate(
          [
            { opacity: 0, transform: 'scaleY(0)', offset: 0 },
            { opacity: 0, transform: 'scaleY(0)', offset: Math.max(0, ap - 0.04) },
            { opacity: 0.5, transform: 'scaleY(1)', offset: Math.min(0.99, ap + 0.06) },
            { opacity: 0.5, transform: 'scaleY(1)', offset: 0.82 },
            { opacity: 0, transform: 'scaleY(1)', offset: 0.97 },
            { opacity: 0, transform: 'scaleY(0)', offset: 1 },
          ],
          {
            duration: DUR,
            iterations: Infinity,
            delay: opt.delay ?? 0,
            easing: 'cubic-bezier(.2,.8,.2,1)',
          },
        );
      });
    }

    /* ---- donut gauge (ring fills) ---- */
    function donut(cx: number, cy: number, r: number, opt: DonutOpt): void {
      const lyr = layer;
      if (!lyr) return;
      const w = opt.w ?? 9;
      const pct = opt.pct ?? 0.72;
      const track = el('circle', {
        cx,
        cy,
        r,
        fill: 'none',
        stroke: 'rgba(110,231,167,.14)',
        'stroke-width': w,
      });
      const prog = el('circle', {
        cx,
        cy,
        r,
        fill: 'none',
        stroke: opt.stroke ?? '#34d399',
        'stroke-width': w,
        'stroke-linecap': 'round',
        transform: `rotate(-90 ${cx} ${cy})`,
      });
      prog.setAttribute('class', 'rline');
      lyr.appendChild(track);
      lyr.appendChild(prog);
      const C = 2 * Math.PI * r;
      const target = C * (1 - pct);
      if (!canAnimate) {
        prog.style.strokeDasharray = String(C);
        prog.style.strokeDashoffset = String(target);
        prog.style.opacity = '0.55';
        track.style.opacity = '0.5';
        return;
      }
      prog.style.strokeDasharray = String(C);
      prog.style.strokeDashoffset = String(C);
      prog.animate(
        [
          { strokeDashoffset: C, opacity: 0, offset: 0 },
          { opacity: 0.55, offset: 0.06 },
          { strokeDashoffset: target, opacity: 0.55, offset: 0.5 },
          { strokeDashoffset: target, opacity: 0.55, offset: 0.82 },
          { strokeDashoffset: C, opacity: 0, offset: 0.99 },
          { strokeDashoffset: C, opacity: 0, offset: 1 },
        ],
        { duration: DUR, iterations: Infinity, delay: opt.delay ?? 0, easing: 'ease-in-out' },
      );
    }

    /* ---- check mark (draws once, then gently floats) ---- */
    function tick(x: number, y: number, size: number, delay: number): void {
      const lyr = layer;
      if (!lyr) return;
      const s = size / 24;
      const outer = el('g', { transform: `translate(${x - 12 * s},${y - 12 * s}) scale(${s})` });
      const inner = el('g', {});
      inner.setAttribute('class', 'tickbob');
      inner.style.animationDelay = `${delay / 1000}s`;
      const path = el('path', {
        d: 'M20 6 9 17l-5-5',
        fill: 'none',
        stroke: '#34d399',
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      path.setAttribute('class', 'rline');
      inner.appendChild(path);
      outer.appendChild(inner);
      lyr.appendChild(outer);
      path.style.opacity = '0.5';
      if (!canAnimate) return;
      const L = (path as SVGGeometryElement).getTotalLength();
      path.style.strokeDasharray = String(L);
      path.style.strokeDashoffset = String(L);
      path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], {
        duration: 700,
        delay,
        fill: 'forwards',
        easing: 'ease-out',
      });
    }

    /* ---- compose to the actual viewport size ---- */
    function build(): void {
      const w = Math.max(320, window.innerWidth);
      const h = Math.max(420, window.innerHeight);
      const u = Math.min(w, h);
      const mobile = w < 600;
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
      if (layer) layer.remove();
      layer = document.createElementNS(SVGNS, 'g');
      svgEl.appendChild(layer);

      const xs = [0.03, 0.18, 0.33, 0.48, 0.63, 0.78, 0.97];
      const yf = [0.74, 0.66, 0.7, 0.6, 0.64, 0.55, 0.5];
      const pts: Pt[] = xs.map((x, i) => [+(x * w).toFixed(1), +((yf[i] ?? 0.6) * h).toFixed(1)]);
      lineChart(pts, {
        stroke: '#4ade80',
        w: Math.max(2, u * 0.0034),
        r: Math.max(3, u * 0.006),
        dot: '#9af3c0',
        areaFill: 'url(#oses-area1)',
        areaBottom: h,
        delay: 0,
      });

      const nBars = mobile ? 5 : 7;
      const bw = Math.max(10, w * 0.016);
      const gap = bw * 0.72;
      const hbase = [0.13, 0.18, 0.11, 0.21, 0.15, 0.24, 0.17];
      const heights: number[] = [];
      for (let i = 0; i < nBars; i += 1) heights.push((hbase[i] ?? 0.15) * h);
      barChart(w * 0.06, h * (mobile ? 0.28 : 0.33), heights, { w: bw, gap, delay: 500 });

      donut(w * (mobile ? 0.8 : 0.86), h * (mobile ? 0.15 : 0.18), u * (mobile ? 0.1 : 0.08), {
        w: Math.max(6, u * 0.012),
        pct: 0.72,
        delay: 900,
      });

      const ticks: Array<[number, number, number, number]> = mobile
        ? [
            [0.15, 0.5, 0.075, 300],
            [0.85, 0.58, 0.06, 900],
            [0.55, 0.88, 0.085, 600],
          ]
        : [
            [0.13, 0.52, 0.05, 300],
            [0.88, 0.6, 0.044, 900],
            [0.36, 0.16, 0.04, 1500],
            [0.62, 0.85, 0.055, 600],
          ];
      ticks.forEach((t) => {
        tick(t[0] * w, t[1] * h, t[2] * u, t[3]);
      });
    }

    let rt: number | undefined;
    try {
      build();
    } catch {
      /* unsupported environment (e.g. tests) — leave the static defs in place */
    }
    const onResize = (): void => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => {
        try {
          build();
        } catch {
          /* ignore */
        }
      }, 200);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(rt);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="oses-area1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#34d399" stopOpacity="0.3" />
            <stop offset="1" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="oses-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4ade80" />
            <stop offset="1" stopColor="#157f43" />
          </linearGradient>
        </defs>
      </svg>

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

export default DashboardBackground;
