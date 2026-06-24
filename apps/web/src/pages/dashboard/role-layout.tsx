/**
 * RoleLayout — persistent app shell (floating sidebar + top bar) with an <Outlet/>
 * for the active module page. Responsive: on desktop the sidebar is static; below
 * `lg` it collapses into a slide-in drawer toggled by a hamburger (backdrop + Esc +
 * close-on-navigate). Nav (incl. submenus) comes from the logged-in user's role.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ThemeToggle } from '@/design-system/atoms/theme-toggle';
import { useAuth } from '@/hooks';
import { cn, getInitials } from '@/lib/utils';

import { type NavItem, ROLE_CONFIG } from './roles.config';

function LogoutIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function MenuIcon(): React.ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon(): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LeafLink({ item, pathname }: { item: NavItem; pathname: string }): React.ReactElement {
  const active = item.to === pathname;
  return (
    <Link
      to={item.to ?? '#'}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 -left-2 w-1 rounded-full bg-brand"
        />
      )}
      <span className={cn('h-4 w-4 rounded', active ? 'bg-brand' : 'bg-current opacity-40')} />
      {item.label}
    </Link>
  );
}

function ChevronIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** Collapsible nav group — closed by default, auto-opens when a child is active. */
function NavGroup({ item, pathname }: { item: NavItem; pathname: string }): React.ReactElement {
  const children = item.children ?? [];
  const hasActiveChild = children.some((c) => c.to === pathname);
  const [open, setOpen] = useState(() => hasActiveChild);

  // Auto-open the group when navigating into one of its children.
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          hasActiveChild
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <span
          className={cn('h-4 w-4 rounded', hasActiveChild ? 'bg-brand' : 'bg-current opacity-40')}
        />
        <span className="flex-1">{item.label}</span>
        <ChevronIcon
          className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="ml-[1.4rem] mt-1 flex flex-col gap-1 border-l border-border pl-2">
          {children.map((child) => {
            const active = child.to === pathname;
            return (
              <Link
                key={child.label}
                to={child.to ?? '#'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-md px-3 py-1.5 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 -left-2 w-0.5 rounded-full bg-brand"
                  />
                )}
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RoleLayout(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navSections = (user && ROLE_CONFIG[user.role]?.nav) || [];
  const pathname = location.pathname;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close the mobile drawer when the route changes (i.e. after tapping a nav item).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Close the mobile drawer on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset the drawer state when crossing to the desktop breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (): void => {
      if (mq.matches) setDrawerOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Focus management for the mobile drawer: move focus in, trap it, restore on close.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const drawer = drawerRef.current;
    if (!drawer) return undefined;
    const trigger = triggerRef.current;

    const getFocusable = (): HTMLElement[] =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    getFocusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    drawer.addEventListener('keydown', onKeyDown);
    return () => {
      drawer.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="flex h-screen gap-3 overflow-hidden bg-background p-3 text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:border focus:border-border focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:outline-none focus:ring-1 focus:ring-ring"
      >
        Skip to content
      </a>

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static on desktop, slide-in drawer below lg */}
      <aside
        ref={drawerRef}
        role={drawerOpen ? 'dialog' : undefined}
        aria-modal={drawerOpen ? true : undefined}
        aria-label={drawerOpen ? 'Navigation menu' : undefined}
        className={cn(
          'fixed inset-y-3 left-3 z-50 flex w-64 flex-col rounded-2xl border border-border bg-card shadow-xl transition-transform duration-200',
          'lg:static lg:z-auto lg:shrink-0 lg:shadow-sm',
          drawerOpen ? 'translate-x-0' : '-translate-x-[110%] lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2.5 px-5">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-brand-gradient" />
            <span className="font-serif text-xl text-foreground">OSES</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) =>
                  item.children ? (
                    <NavGroup key={item.label} item={item} pathname={pathname} />
                  ) : (
                    <LeafLink key={item.label} item={item} pathname={pathname} />
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* bottom promo card placeholder */}
        <div className="m-3 rounded-xl bg-neutral-900 p-4 text-neutral-50 shadow-sm">
          <div className="h-3 w-24 rounded bg-white/30" />
          <div className="mt-2 h-2 w-32 rounded bg-white/15" />
          <div className="mt-4 h-8 rounded-md bg-white/15" />
        </div>
      </aside>

      {/* Right column */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-sm sm:px-6">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:hidden"
          >
            <MenuIcon />
          </button>

          <div className="hidden h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground md:flex">
            <span className="h-4 w-4 rounded bg-muted" />
            Search…
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 pl-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
                {user ? getInitials(user.fullName) : '?'}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-medium text-foreground">{user?.fullName ?? 'Guest'}</p>
                <p className="text-xs text-muted-foreground">{user?.email ?? ''}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                void navigate('/login');
              }}
              title="Log out"
              aria-label="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <LogoutIcon />
            </button>
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-auto pr-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default RoleLayout;
