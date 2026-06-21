/**
 * REFERENCE PAGE PATTERN — SchoolDetailPage
 * Shows an edit form pre-filled with mock school data.
 * TODO: Replace mock data with API call. Add save/delete API calls.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/design-system/atoms/button';
import { SchoolForm } from '@/design-system/organisms/school-form';
import { PageLayout } from '@/design-system/templates/page-layout';

import type { CreateSchoolDto, School } from '@oses/types';
import { OnboardingStatus } from '@oses/types';

const MOCK_SCHOOL: School = {
  id: 'sch_001',
  schoolCode: 'LHR-001',
  schoolName: 'Government High School Gulberg',
  city: 'Lahore',
  contactEmail: 'principal@ghsg.edu.pk',
  contactPhone: '+92-42-35761234',
  onboardingStatus: OnboardingStatus.COMPLETE,
  isActive: true,
  createdAt: '2025-01-15T08:00:00.000Z',
  updatedAt: '2025-06-10T12:30:00.000Z',
};

export function SchoolDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // TODO: replace with API call: useQuery(['school', id], () => schoolsApi.findOne(id))
  const school = MOCK_SCHOOL;

  const handleSubmit = (dto: CreateSchoolDto): void => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    // TODO: replace with API call: schoolsApi.update(id, dto)
    setTimeout(() => {
      console.log('Update school:', id, dto);
      setIsSubmitting(false);
      setSuccessMessage('School updated successfully');
    }, 1000);
  };

  return (
    <PageLayout
      title="School Details"
      subtitle={school.schoolCode}
      actions={
        <Button variant="ghost" onClick={() => void navigate('/admin/schools')}>
          Back to Schools
        </Button>
      }
    >
      <div className="mx-auto max-w-3xl">
        {successMessage && (
          <div
            role="status"
            className="mb-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {successMessage}
          </div>
        )}

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <SchoolForm
            initialValues={{
              schoolCode: school.schoolCode,
              schoolName: school.schoolName,
              city: school.city,
              contactEmail: school.contactEmail,
              contactPhone: school.contactPhone,
            }}
            mode="edit"
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            onCancel={() => void navigate('/admin/schools')}
          />
        </div>
      </div>
    </PageLayout>
  );
}

export default SchoolDetailPage;
