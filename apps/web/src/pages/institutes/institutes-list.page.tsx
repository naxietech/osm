/**
 * REFERENCE PAGE PATTERN — InstitutesListPage
 * This is the reference for all future list pages.
 * Pattern:
 * 1. PageHeader widget (title + actions) — renders inside the shared role shell
 * 2. DataTable organism with typed columns
 * 3. Mock data with TODO for API integration
 * 4. Row click navigates to detail page
 * 5. Action button navigates to the create flow
 *
 * TODO: Replace MOCK_INSTITUTES with API call via React Query in next phase.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { type InstituteListItem, OnboardingStatus } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { StatusBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';

const MOCK_INSTITUTES: InstituteListItem[] = [
  {
    id: 'sch_001',
    instituteCode: 'LHR-001',
    instituteName: 'Government High School Gulberg',
    city: 'Lahore',
    onboardingStatus: OnboardingStatus.COMPLETE,
    isActive: true,
  },
  {
    id: 'sch_002',
    instituteCode: 'KHI-001',
    instituteName: 'Government Boys Secondary School Clifton',
    city: 'Karachi',
    onboardingStatus: OnboardingStatus.IN_PROGRESS,
    isActive: true,
  },
  {
    id: 'sch_003',
    instituteCode: 'ISB-001',
    instituteName: 'Federal Government School F-8',
    city: 'Islamabad',
    onboardingStatus: OnboardingStatus.PENDING,
    isActive: true,
  },
];

export function InstitutesListPage(): React.ReactElement {
  const navigate = useNavigate();

  const columns: ColumnDef<InstituteListItem>[] = [
    {
      key: 'instituteName',
      header: 'Institute Name',
      render: (row) => <span className="font-medium">{row.instituteName}</span>,
    },
    {
      key: 'instituteCode',
      header: 'Code',
      render: (row) => (
        <span className="font-mono text-sm text-muted-foreground">{row.instituteCode}</span>
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
            void navigate(`/admin/institutes/${row.id}`);
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
        title="Institutes"
        subtitle="Manage institute onboarding and configurations"
        actions={
          <Button variant="primary" onClick={() => void navigate('/admin/institutes/add')}>
            Add Institute
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<InstituteListItem>
          data={MOCK_INSTITUTES}
          columns={columns}
          onRowClick={(row) => void navigate(`/admin/institutes/${row.id}`)}
          emptyMessage="No institutes found"
        />
      </div>
    </>
  );
}

export default InstitutesListPage;
