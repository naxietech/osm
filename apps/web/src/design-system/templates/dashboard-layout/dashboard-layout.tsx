import { type ReactElement, type ReactNode, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { type NavSection, Sidebar } from '@/design-system/organisms/sidebar';
import { Topbar } from '@/design-system/organisms/topbar';

import { useDrawer } from './use-drawer';
import { useFocusTrap } from './use-focus-trap';

export interface DashboardLayoutProps {
  /** Navigation sections for the current role. */
  navSections: NavSection[];
  /** Signed-in user shown in the top bar. */
  user: { fullName: string; email: string } | null;
  /** Called when the user logs out. */
  onLogout: () => void;
  /** The active page — typically a router <Outlet/>. */
  children: ReactNode;
}

/**
 * Persistent app shell: a responsive sidebar + top bar around the active page.
 * Presentational — it takes the nav, user and logout callback as props (the app
 * wires those to auth / role config), so it can be previewed and tested on its own.
 * Below `lg` the sidebar becomes a focus-trapped drawer toggled from the top bar.
 */
export function DashboardLayout({
  navSections,
  user,
  onLogout,
  children,
}: DashboardLayoutProps): ReactElement {
  const { pathname } = useLocation();
  const { open, openDrawer, closeDrawer } = useDrawer(pathname);
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useFocusTrap({ active: open, containerRef: drawerRef, restoreRef: triggerRef });

  return (
    <div className="flex h-screen gap-3 overflow-hidden bg-background p-3 text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:border focus:border-border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:outline-none focus:ring-1 focus:ring-ring"
      >
        Skip to content
      </a>

      <Sidebar
        ref={drawerRef}
        sections={navSections}
        pathname={pathname}
        open={open}
        onClose={closeDrawer}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <Topbar
          user={user}
          drawerOpen={open}
          onOpenMenu={openDrawer}
          onLogout={onLogout}
          menuButtonRef={triggerRef}
        />
        <main id="main-content" className="flex-1 overflow-auto pr-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
