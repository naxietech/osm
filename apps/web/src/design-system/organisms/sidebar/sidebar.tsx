import { forwardRef } from 'react';

import { X } from '@/design-system/atoms/icon';
import { cn } from '@/lib/utils';

import type { NavSection } from './nav.types';
import { SidebarNav } from './sidebar-nav';

export interface SidebarProps {
  sections: NavSection[];
  pathname: string;
  /** Whether the mobile drawer is open. */
  open: boolean;
  /** Close the mobile drawer (backdrop / close button). */
  onClose: () => void;
}

/**
 * App sidebar: brand, role navigation and a promo slot. Static on desktop; below
 * `lg` it's an off-canvas drawer with a backdrop. The forwarded ref points at the
 * <aside> so the layout can trap focus inside it while the drawer is open.
 */
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { sections, pathname, open, onClose },
  ref,
) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={ref}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? 'Navigation menu' : undefined}
        className={cn(
          'fixed inset-y-3 left-3 z-50 flex w-64 flex-col rounded-2xl border border-border bg-card shadow-xl transition-transform duration-200',
          'lg:static lg:z-auto lg:shrink-0 lg:shadow-sm',
          open ? 'translate-x-0' : '-translate-x-[110%] lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2.5 px-5">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-brand-gradient" />
            <span className="text-xl font-semibold text-foreground">OSES</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <SidebarNav sections={sections} pathname={pathname} />

        {/* bottom promo card placeholder */}
        <div className="m-3 rounded-xl bg-neutral-900 p-4 text-neutral-50 shadow-sm">
          <div className="h-3 w-24 rounded bg-white/30" />
          <div className="mt-2 h-2 w-32 rounded bg-white/15" />
          <div className="mt-4 h-8 rounded-md bg-white/15" />
        </div>
      </aside>
    </>
  );
});

export default Sidebar;
