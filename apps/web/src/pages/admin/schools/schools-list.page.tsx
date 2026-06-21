/**
 * REFERENCE PAGE PATTERN — SchoolsListPage
 * This is the reference for all future list pages.
 * Pattern:
 * 1. PageLayout template with title and action button
 * 2. DataTable organism with typed columns
 * 3. Mock data with TODO for API integration
 * 4. Row click navigates to detail page
 * 5. Action button navigates to create flow (or opens modal — TBD)
 *
 * TODO: Replace MOCK_SCHOOLS with API call via React Query in next phase.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/design-system/atoms/button';
import { DataTable, type ColumnDef } from '@/design-system/organisms/data-table';
import { StatusBadge } from '@/design-system/molecules/status-badge';
import { PageLayout } from '@/design-system/templates/page-layout';

import type { SchoolListItem } from '@oses/types';
import { OnboardingStatus } from '@oses/types';

const MOCK_SCHOOLS: SchoolListItem[] = [
  {
    id: 'sch_001',
    schoolCode: 'LHR-001',
    schoolName: 'Government High School Gulberg',
    city: 'Lahore',
    onboardingStatus: OnboardingStatus.COMPLETE,
    isActive: true,
  },
  {
    id: 'sch_002',
    schoolCode: 'KHI-001',
    schoolName: 'Government Boys Secondary School Clifton',
    city: 'Karachi',
    onboardingStatus: OnboardingStatus.IN_PROGRESS,
    isActive: true,
  },
  {
    id: 'sch_003',
    schoolCode: 'ISB-001',
    schoolName: 'Federal Government School F-8',
    city: 'Islamabad',
    onboardingStatus: OnboardingStatus.PENDING,
    isActive: true,
  },
];

export function SchoolsListPage(): React.ReactElement {
  const navigate = useNavigate();

  const columns: ColumnDef<SchoolListItem>[] = [
    {
      key: 'schoolName',
      header: 'School Name',
      render: (row) => <span className="font-medium">{row.schoolName}</span>,
    },
    {
      key: 'schoolCode',
      header: 'Code',
      render: (row) => (
        <span className="font-mono text-sm text-gray-600">{row.schoolCode}</span>
      ),
      width: '120px',
    },
    {
      key: 'city',
      header: 'City',
      render: (row) => row.city,
      width: '140px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.onboardingStatus} />,
      width: '160px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            void navigate(`/admin/schools/${row.id}`);
          }}
        >
          View
        </Button>
      ),
      width: '100px',
    },
  ];

  return (
    <PageLayout
      title="Schools"
      subtitle="Manage school onboarding and configurations"
      actions={
        <Button
          variant="primary"
          onClick={() => {
            // TODO: navigate to create school page or open modal
            console.log('Add School clicked — TODO: implement create flow');
          }}
        >
          Add School
        </Button>
      }
    >
      <div className="rounded-lg border bg-white shadow-sm">
        <DataTable<SchoolListItem>
          data={MOCK_SCHOOLS}
          columns={columns}
          onRowClick={(row) => void navigate(`/admin/schools/${row.id}`)}
          emptyMessage="No schools found"
        />
      </div>
    </PageLayout>
  );
}

export default SchoolsListPage;
