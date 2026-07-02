/** Shared status pill for exams — one mapping used by the list, detail and candidate pages. */
import React from 'react';

import { ExamStatus } from '@oses/types';

import { Badge, type BadgeProps } from '@/design-system/atoms/badge';

const CONFIG: Record<ExamStatus, { label: string; variant: BadgeProps['variant'] }> = {
  [ExamStatus.DRAFT]: { label: 'Draft', variant: 'default' },
  [ExamStatus.REGISTRATION_OPEN]: { label: 'Registration Open', variant: 'success' },
  [ExamStatus.REGISTRATION_CLOSED]: { label: 'Registration Closed', variant: 'info' },
  [ExamStatus.IN_PROGRESS]: { label: 'In Progress', variant: 'warning' },
  [ExamStatus.COMPLETED]: { label: 'Completed', variant: 'default' },
};

export function ExamStatusBadge({ status }: { status: ExamStatus }): React.ReactElement {
  const config = CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default ExamStatusBadge;
