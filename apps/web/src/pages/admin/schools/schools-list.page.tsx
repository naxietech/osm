/**
 * REFERENCE PAGE PATTERN — SchoolsListPage
 * This is the reference for all future list pages.
 * Pattern:
 * 1. PageHeader widget (title + actions) — renders inside the shared role shell
 * 2. DataTable organism with typed columns
 * 3. Mock data with TODO for API integration
 * 4. Row click navigates to detail page
 * 5. Action button navigates to the create flow
 *
 * TODO: Replace MOCK_SCHOOLS with API call via React Query in next phase.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { OnboardingStatus, type SchoolListItem } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { StatusBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';

import { PageHeader } from '../../dashboard/widgets';

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
        <span className="font-mono text-sm text-muted-foreground">{row.schoolCode}</span>
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
    <>
      <PageHeader
        title="Schools"
        subtitle="Manage school onboarding and configurations"
        actions={
          <Button variant="primary" onClick={() => void navigate('/admin/schools/add')}>
            Add School
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<SchoolListItem>
          data={MOCK_SCHOOLS}
          columns={columns}
          onRowClick={(row) => void navigate(`/admin/schools/${row.id}`)}
          emptyMessage="No schools found"
        />
      </div>
    </>
  );
}

export default SchoolsListPage;
