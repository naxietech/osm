import React, { useEffect, useRef } from 'react';

/**
 * Friendly graduate-owl mascot for the login card. Ambient behaviour (idle bob,
 * blinking, eyes following the cursor) is always on; the form reactions wire into
 * the real inputs found inside {@link MascotProps.scopeRef}:
 *
 *  - email focus/typing  → the eyes "read along" and the mouth widens on a valid address
 *  - password focus      → the owl covers its eyes with its wings
 *  - password reveal      → it peeks between its wings (detected via the input's `type`)
 *
 * Styling/animation lives in `styles/auth.css` (scoped under `.oses-auth`). The
 * SVG is decorative (aria-hidden) and never blocks the form (the wrapper is
 * pointer-events-none).
 */

const MOUTH = {
  smile: 'M104 158 q16 14 32 0',
  big: 'M100 156 q20 20 40 0',
  think: 'M112 160 q8 7 16 0',
} as const;

type MouthKey = keyof typeof MOUTH;

export interface MascotProps {
  /** Element containing the `#email` / `#password` inputs the mascot reacts to. */
  scopeRef: React.RefObject<HTMLElement | null>;
}

export function Mascot({ scopeRef }: MascotProps): React.ReactElement {
  const rootRef = useRef<SVGSVGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const pupilLRef = useRef<SVGCircleElement>(null);
  const pupilRRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const mascot = rootRef.current;
    const mouth = mouthRef.current;
    if (!mascot || !mouth) return;
    const pupils: SVGCircleElement[] = [pupilLRef.current, pupilRRef.current].filter(
      (p): p is SVGCircleElement => p !== null,
    );

    let reading = false;
    const setMouth = (s: MouthKey): void => {
      mouth.setAttribute('d', MOUTH[s]);
    };
    const setPupils = (dx: number, dy: number): void => {
      pupils.forEach((p) => {
        p.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    const busy = (): boolean =>
      mascot.classList.contains('cover') || mascot.classList.contains('happy') || reading;

    const onMove = (e: PointerEvent): void => {
      if (busy()) return;
      const r = mascot.getBoundingClientRect();
      if (!r.width) return;
      pupils.forEach((p, i) => {
        const baseX = i === 0 ? 100 : 140;
        const ecx = r.left + r.width * (baseX / 240);
        const ecy = r.top + r.height * (130 / 220);
        const ang = Math.atan2(e.clientY - ecy, e.clientX - ecx);
        const d = Math.min(7, Math.hypot(e.clientX - ecx, e.clientY - ecy) / 16);
        p.style.transform = `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d}px)`;
      });
    };
    window.addEventListener('pointermove', onMove);

    const blink = window.setInterval(() => {
      if (mascot.classList.contains('cover') || mascot.classList.contains('happy')) return;
      mascot.classList.add('blink');
      window.setTimeout(() => {
        mascot.classList.remove('blink');
      }, 150);
    }, 3200);

    const cleanups: Array<() => void> = [];
    const scope = scopeRef.current;
    const email = scope?.querySelector<HTMLInputElement>('#email') ?? null;
    const pass = scope?.querySelector<HTMLInputElement>('#password') ?? null;

    if (email) {
      const onFocus = (): void => {
        reading = true;
        setPupils(-6, 5);
      };
      const onBlur = (): void => {
        reading = false;
      };
      const onInput = (): void => {
        const v = email.value;
        const frac = Math.min(1, v.length / 22);
        setPupils(-6 + frac * 12, 5);
        const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
        mascot.classList.toggle('valid', valid);
        setMouth(valid ? 'big' : 'smile');
      };
      email.addEventListener('focus', onFocus);
      email.addEventListener('blur', onBlur);
      email.addEventListener('input', onInput);
      cleanups.push(() => {
        email.removeEventListener('focus', onFocus);
        email.removeEventListener('blur', onBlur);
        email.removeEventListener('input', onInput);
      });
    }

    if (pass) {
      const onFocus = (): void => {
        mascot.classList.add('cover');
      };
      const onBlur = (): void => {
        mascot.classList.remove('cover', 'peek');
      };
      pass.addEventListener('focus', onFocus);
      pass.addEventListener('blur', onBlur);
      const mo = new MutationObserver(() => {
        mascot.classList.toggle('peek', pass.type === 'text');
      });
      mo.observe(pass, { attributes: true, attributeFilter: ['type'] });
      cleanups.push(() => {
        pass.removeEventListener('focus', onFocus);
        pass.removeEventListener('blur', onBlur);
        mo.disconnect();
      });
    }

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.clearInterval(blink);
      cleanups.forEach((fn) => {
        fn();
      });
    };
  }, [scopeRef]);

  return (
    <svg ref={rootRef} className="mascot" viewBox="0 0 240 220" aria-hidden>
      <defs>
        <linearGradient id="oses-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c8d5d" />
          <stop offset="1" stopColor="#155235" />
        </linearGradient>
      </defs>
      <g className="cap">
        <path d="M120 72 L168 72 L168 110" fill="none" stroke="#0f3b27" strokeWidth="3" />
        <circle cx="168" cy="114" r="6" fill="#fbbf24" />
        <polygon points="120,40 206,72 120,104 34,72" fill="#103a27" />
        <rect x="92" y="78" width="56" height="26" rx="8" fill="#103a27" />
        <circle cx="120" cy="72" r="4" fill="#a7f3d0" />
      </g>
      <circle cx="120" cy="128" r="60" fill="url(#oses-face)" />
      <circle cx="86" cy="152" r="9" fill="#fff" opacity="0.12" />
      <circle cx="154" cy="152" r="9" fill="#fff" opacity="0.12" />
      <path
        className="brow brow-l"
        d="M86 106 q14 -7 28 -1"
        fill="none"
        stroke="#0c2e1e"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        className="brow brow-r"
        d="M126 105 q14 -6 28 1"
        fill="none"
        stroke="#0c2e1e"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g className="eye eye-l">
        <ellipse className="eye-white" cx="100" cy="128" rx="17" ry="18" fill="#fff" />
        <circle
          ref={pupilLRef}
          className="pupil pupil-l"
          cx="100"
          cy="130"
          r="7.5"
          fill="#0e1b14"
        />
        <path
          className="happy-eye"
          d="M90 130 q10 -12 20 0"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <g className="eye eye-r">
        <ellipse className="eye-white" cx="140" cy="128" rx="17" ry="18" fill="#fff" />
        <circle
          ref={pupilRRef}
          className="pupil pupil-r"
          cx="140"
          cy="130"
          r="7.5"
          fill="#0e1b14"
        />
        <path
          className="happy-eye"
          d="M130 130 q10 -12 20 0"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <path
        ref={mouthRef}
        id="oses-mouth"
        d="M104 158 q16 14 32 0"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g className="hands">
        <ellipse
          className="hand hand-l"
          cx="100"
          cy="126"
          rx="22"
          ry="17"
          fill="#2c8d5d"
          stroke="#0f3b27"
          strokeWidth="2"
        />
        <ellipse
          className="hand hand-r"
          cx="140"
          cy="126"
          rx="22"
          ry="17"
          fill="#2c8d5d"
          stroke="#0f3b27"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}

export default Mascot;
