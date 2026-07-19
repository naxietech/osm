import React, { useRef } from 'react';

import { Mascot } from '@/design-system/atoms/mascot';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

/** OSES shield/graduation mark used in the brand lockup. */
function BrandMark({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  );
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
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* secure footer */}
          <div className="flex items-center gap-2.5 text-[13px] text-white/75">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
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
