import React from 'react';

import { OnboardingStatus } from '@oses/types';

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

export default StatusBadge;
