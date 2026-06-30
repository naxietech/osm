import React, { useRef } from 'react';

import { Mascot } from '@/design-system/atoms/mascot';
import { LoginBackground } from '@/design-system/organisms/login-background';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * Immersive dark auth shell: a graduate-owl {@link Mascot} on a frosted-glass card
 * floating over the animated {@link LoginBackground} (line/area, bars, donut
 * and check marks). The whole screen is forced into dark (`.dark` wrapper) so the
 * design-system form atoms used as children render their dark variants and match
 * the card automatically.
 *
 * API is intentionally unchanged (title / subtitle / children) so pages built on
 * it — currently the login page — need no edits.
 */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div className="oses-auth dark relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[radial-gradient(125%_125%_at_50%_0%,#0d2c1d_0%,#08180f_48%,#050d09_100%)] px-4 py-16 text-[#e8f3ee]">
      <LoginBackground />

      <div className="relative z-10 w-full max-w-md">
        <div
          ref={cardRef}
          className="oses-card relative rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,46,33,0.66),rgba(13,30,21,0.62))] px-6 pb-8 pt-[88px] shadow-[0_44px_100px_-36px_rgba(0,0,0,0.78)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-2xl sm:px-8"
        >
          {/* graduate-owl mascot, overhanging the top of the card */}
          <div className="pointer-events-none absolute left-1/2 top-[-82px] z-30 h-[150px] w-[178px] -translate-x-1/2">
            <Mascot scopeRef={cardRef} />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[#f1faf5]">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-[#8aa89a]">{subtitle}</p>}
          </div>

          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
