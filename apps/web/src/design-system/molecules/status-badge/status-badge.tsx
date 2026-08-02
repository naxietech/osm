import React from 'react';

import {
  type MarkingBand,
  type MarkingBatchStatus,
  type MarkingScriptStatus,
  OnboardingStatus,
  type UserStatus,
} from '@oses/types';

import { Badge, type BadgeProps } from '@/design-system/atoms/badge';

export interface StatusBadgeProps {
  status: OnboardingStatus;
}

const statusConfig: Record<OnboardingStatus, { label: string; variant: BadgeProps['variant'] }> = {
  [OnboardingStatus.PENDING]: { label: 'Pending', variant: 'warning' },
  [OnboardingStatus.IN_PROGRESS]: { label: 'In Progress', variant: 'info' },
  [OnboardingStatus.COMPLETE]: { label: 'Complete', variant: 'success' },
  [OnboardingStatus.SUSPENDED]: { label: 'Suspended', variant: 'error' },
};

export function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export interface UserStatusBadgeProps {
  status: UserStatus;
}

/**
 * Account state on the admin user directory. `locked` is the server's own brute-force
 * lockout, which clears itself after a short window — distinct from `suspended`, which an
 * admin set deliberately and only an admin can undo, so the two must not look alike.
 */
const userStatusConfig: Record<UserStatus, { label: string; variant: BadgeProps['variant'] }> = {
  pending: { label: 'Pending', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'error' },
  locked: { label: 'Locked', variant: 'warning' },
};

export function UserStatusBadge({ status }: UserStatusBadgeProps): React.ReactElement {
  const config = userStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export interface RoleTypeBadgeProps {
  /** True for the seeded TRD roles, which the server owns and nobody can edit. */
  isSystem: boolean;
}

/** System vs custom role on the roles directory. */
export function RoleTypeBadge({ isSystem }: RoleTypeBadgeProps): React.ReactElement {
  return <Badge variant={isSystem ? 'default' : 'info'}>{isSystem ? 'System' : 'Custom'}</Badge>;
}

export interface ActiveBadgeProps {
  active: boolean;
}

/**
 * Active / Inactive pill for the reference-data tables (subjects, classes, SLOs,
 * categories). Extracted after the identical component was found copy-pasted into four
 * setup pages, each re-writing the classes the Badge atom already provides.
 */
export function ActiveBadge({ active }: ActiveBadgeProps): React.ReactElement {
  return <Badge variant={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Badge>;
}

// ---- marking -------------------------------------------------------------------
// Label and colour live here rather than in marking.service because the design system
// may not import services, and one mapping beats a page-local copy in every table.

const batchStatusConfig: Record<
  MarkingBatchStatus,
  { label: string; variant: BadgeProps['variant'] }
> = {
  queued: { label: 'Queued', variant: 'default' },
  'in-progress': { label: 'In progress', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
};

export interface MarkingBatchStatusBadgeProps {
  status: MarkingBatchStatus;
}

/** Where a batch of scripts stands in the checker's queue. */
export function MarkingBatchStatusBadge({
  status,
}: MarkingBatchStatusBadgeProps): React.ReactElement {
  const config = batchStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const scriptStatusConfig: Record<
  MarkingScriptStatus,
  { label: string; variant: BadgeProps['variant'] }
> = {
  pending: { label: 'Pending', variant: 'default' },
  marked: { label: 'Marked', variant: 'success' },
  // Amber, not red: a flag is work handed to a supervisor, not a failure.
  flagged: { label: 'Flagged', variant: 'warning' },
};

export interface MarkingScriptStatusBadgeProps {
  status: MarkingScriptStatus;
}

/** Where one script stands. */
export function MarkingScriptStatusBadge({
  status,
}: MarkingScriptStatusBadgeProps): React.ReactElement {
  const config = scriptStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

/**
 * The four-band scale. Colours follow the project's reserved meanings — green correct,
 * red incorrect, amber partial — so BOTH partial bands are amber by design.
 */
const bandConfig: Record<MarkingBand, { label: string; variant: BadgeProps['variant'] }> = {
  correct: { label: 'Correct', variant: 'success' },
  'partially-correct': { label: 'Partially Correct', variant: 'warning' },
  'partially-incorrect': { label: 'Partially Incorrect', variant: 'warning' },
  incorrect: { label: 'Incorrect', variant: 'error' },
};

export interface MarkingBandBadgeProps {
  band: MarkingBand;
}

/** The band a marked script was awarded. */
export function MarkingBandBadge({ band }: MarkingBandBadgeProps): React.ReactElement {
  const config = bandConfig[band];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default StatusBadge;
