/**
 * REFERENCE PATTERN — PageLayout template
 * Provides the shell for every authenticated page.
 * Does NOT contain navigation logic (added when routing is wired).
 * Structure: fixed top nav + fixed left sidebar + scrollable main content
 */
import React from 'react';

import { ThemeToggle } from '@/design-system/atoms/theme-toggle';

export interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const NAV_ITEMS = ['Dashboard', 'Schools', 'Students'];

export function PageLayout({
  children,
  title,
  subtitle,
  actions,
}: PageLayoutProps): React.ReactElement {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-60 border-r border-border bg-card pt-16">
        <div className="px-4 py-3">
          <span className="text-lg font-bold text-brand">OSES</span>
        </div>
        {/* TODO: wire navigation links in router phase */}
        <nav className="mt-4 flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="ml-60 flex flex-1 flex-col overflow-hidden">
        {/* Top nav bar */}
        <header className="fixed left-60 right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="font-serif text-2xl font-normal text-foreground">{title}</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 pt-20">
          {subtitle && <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}

export default PageLayout;
