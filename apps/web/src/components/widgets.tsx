/**
 * Temporary dashboard PLACEHOLDER widgets (shared across the role dashboards).
 * These are skeleton stand-ins, not real design-system components — those come later.
 */
import React from 'react';

import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-xl border p-5 shadow-sm',
        dark ? 'border-transparent bg-brand-gradient text-white' : 'border-border bg-card',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-sm', dark ? 'text-white/80' : 'text-muted-foreground')}>
          {label}
        </span>
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs',
            dark ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          ↗
        </span>
      </div>
      <p className={cn('mt-4 text-3xl font-semibold', dark ? 'text-white' : 'text-foreground')}>
        {value}
      </p>
      <p className={cn('mt-2 text-xs', dark ? 'text-white/70' : 'text-muted-foreground')}>
        Increased from last month
      </p>
    </div>
  );
}

export function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Always-dark accent card (timer / promo style), stays dark in both themes. */
export function DarkCard({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={cn('rounded-xl bg-neutral-900 p-5 text-neutral-50 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function BarChartPlaceholder(): React.ReactElement {
  const bars = [45, 72, 55, 90, 40, 78, 60];
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div>
      <div className="flex h-44 items-end justify-between gap-3">
        {bars.map((h, i) => (
          <div
            key={i}
            className={cn('flex-1 rounded-md', i === 3 ? 'bg-brand' : 'bg-muted')}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-3">
        {days.map((d, i) => (
          <span key={i} className="flex-1 text-center text-xs text-muted-foreground">
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutPlaceholder({ value = 41 }: { value?: number }): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <svg viewBox="0 0 36 36" className="h-36 w-36 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth={3.6} />
        <circle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          className="stroke-brand"
          strokeWidth={3.6}
          strokeDasharray={`${value} 100`}
          strokeLinecap="round"
        />
        <text
          x="18"
          y="19"
          textAnchor="middle"
          className="rotate-90 fill-foreground text-[7px] font-semibold"
        >
          {value}%
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand" />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-subtle" />
          In Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted" />
          Pending
        </span>
      </div>
    </div>
  );
}

export function PersonRow(): React.ReactElement {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
      <div className="flex-1">
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="mt-2 h-2 w-44 rounded bg-muted/60" />
      </div>
      <span className="h-5 w-16 rounded-full bg-muted" />
    </div>
  );
}

export function ItemRow(): React.ReactElement {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="h-8 w-8 shrink-0 rounded-lg bg-muted" />
      <div className="flex-1">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="mt-2 h-2 w-20 rounded bg-muted/60" />
      </div>
    </div>
  );
}

/** A couple of skeleton text lines. */
export function SkeletonLines(): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="h-3 w-40 rounded bg-muted" />
      <div className="h-2 w-28 rounded bg-muted/60" />
    </div>
  );
}

/** Page title block used at the top of each module/home page. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Generic scaffold for a not-yet-built module page. */
export function ModulePlaceholder({
  title,
  subtitle = 'Module scaffold — content coming next.',
}: {
  title: string;
  subtitle?: string;
}): React.ReactElement {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Overview" className="lg:col-span-2">
          <div className="space-y-3">
            <div className="h-3 w-48 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted/60" />
            <div className="h-2 w-2/3 rounded bg-muted/60" />
          </div>
        </Panel>
        <Panel title="Summary">
          <SkeletonLines />
        </Panel>
      </div>
      <Panel title="Records" className="mt-4">
        <ItemRow />
        <ItemRow />
        <ItemRow />
        <ItemRow />
      </Panel>
    </>
  );
}

/** In-layout 404 for unknown sub-routes (renders inside the role shell). */
export function NotFoundPanel(): React.ReactElement {
  return (
    <>
      <PageHeader title="Page not found" subtitle="This page doesn't exist or has moved." />
      <Panel title="404">
        <p className="text-sm text-muted-foreground">Use the sidebar to get back on track.</p>
      </Panel>
    </>
  );
}
