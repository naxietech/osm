import React from 'react';

import { Badge, type BadgeProps } from '@/design-system/atoms/badge';
import { OnboardingStatus } from '@oses/types';

export interface StatusBadgeProps {
  status: OnboardingStatus;
}

const statusConfig: Record<
  OnboardingStatus,
  { label: string; variant: BadgeProps['variant'] }
> = {
  [OnboardingStatus.PENDING]: { label: 'Pending', variant: 'warning' },
  [OnboardingStatus.IN_PROGRESS]: { label: 'In Progress', variant: 'info' },
  [OnboardingStatus.COMPLETE]: { label: 'Complete', variant: 'success' },
  [OnboardingStatus.SUSPENDED]: { label: 'Suspended', variant: 'error' },
};

export function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default StatusBadge;
