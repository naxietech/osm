import React, { useRef } from 'react';

import { BrandMark } from '@/design-system/atoms/brand-mark';
import { Check, ShieldCheck } from '@/design-system/atoms/icon';
import { Mascot } from '@/design-system/atoms/mascot';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const TRUST_POINTS = [
  'End-to-end encrypted & PII-protected',
  'Trusted by examination boards',
  'Fully audit-ready & tamper-evident',
];

/**
 * Split-showcase auth shell. A green-gradient brand panel on the left — drifting
 * aurora, the OSES lockup, the graduate-owl {@link Mascot}, a headline and trust
 * points — sits beside a clean, light form panel on the right that renders the
 * page title/subtitle and form ({@link AuthLayoutProps.children}).
 *
 * The whole screen is scoped `.oses-auth`, which forces the light theme (see
 * styles/auth.css) so the form always reads light regardless of the app's global
 * theme. The brand panel collapses on narrow screens, leaving a compact logo above
 * the form. The owl lives in the brand panel but reacts to the `#email`/`#password`
 * inputs inside the form panel via `scopeRef`.
 *
 * API is unchanged (title / subtitle / children) so the login page needs no edits.
 */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps): React.ReactElement {
  const formRef = useRef<HTMLDivElement>(null);

  return (
    <div className="oses-auth relative min-h-screen w-full bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---- brand panel (left) ---- */}
      <aside className="relative hidden overflow-hidden bg-brand-gradient text-white lg:flex">
        <div className="oses-aurora" aria-hidden>
          <span className="a1" />
          <span className="a2" />
          <span className="a3" />
        </div>

        <div className="relative z-10 flex w-full flex-col justify-between gap-10 p-12 xl:p-14">
          {/* lockup */}
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">
              <BrandMark className="h-6 w-6" />
            </span>
            <span className="text-[22px] font-bold tracking-[0.14em]">OSES</span>
          </div>

          {/* owl + headline */}
          <div>
            <div className="pointer-events-none mb-6 h-[150px] w-[178px]">
              <Mascot scopeRef={formRef} />
            </div>
            <h2 className="max-w-[15ch] text-3xl font-semibold leading-tight tracking-tight">
              Pakistan&rsquo;s secure on-screen exam marking platform
            </h2>
            <p className="mt-3.5 max-w-[36ch] text-[15px] leading-relaxed text-white/80">
              Confidential. Precise. Built for national-scale assessment from registration to
              declared result.
            </p>

            <ul className="mt-8 flex flex-col gap-3.5">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-3 text-[14.5px] text-white/90">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-white/15 ring-1 ring-inset ring-white/20">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* secure footer */}
          <div className="flex items-center gap-2.5 text-[13px] text-white/75">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Government-grade security
          </div>
        </div>
      </aside>

      {/* ---- form panel (right) ---- */}
      <main className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div ref={formRef} className="w-full max-w-sm">
          {/* compact logo — only when the brand panel is hidden */}
          <div className="mb-8 flex items-center gap-3 text-brand lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white">
              <BrandMark className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-[0.14em] text-foreground">OSES</span>
          </div>

          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}

          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
