/**
 * REFERENCE PAGE PATTERN — SchoolDetailPage
 * Doubles as the create flow (no :id route param) and the edit flow (with :id),
 * both driven by the shared SchoolForm organism. Renders inside the shared role
 * shell via PageHeader (no standalone layout).
 * TODO: Replace mock data with API calls (findOne in edit mode; create / update on submit).
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  type CreateSchoolDto,
  InstitutionType,
  OnboardingStatus,
  Province,
  type School,
  SchoolCategory,
  SchoolLevel,
} from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { SchoolForm } from '@/design-system/organisms/school-form';

const MOCK_SCHOOL: School = {
  id: 'sch_001',
  schoolCode: 'LHR-001',
  schoolName: 'Government High School Gulberg',
  registrationNo: 'FBISE-LHR-2019-001',
  institutionType: InstitutionType.GOVERNMENT,
  schoolLevel: SchoolLevel.HIGHER_SECONDARY,
  category: SchoolCategory.BOYS,
  address: '12 Main Boulevard, Gulberg III',
  city: 'Lahore',
  province: Province.PUNJAB,
  postalCode: '54660',
  contactPersonName: 'Ahmed Raza',
  contactPersonDesignation: 'Principal',
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
  const isEdit = Boolean(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // TODO: in edit mode, replace with useQuery(['school', id], () => schoolsApi.findOne(id))
  const school = isEdit ? MOCK_SCHOOL : null;

  const handleSubmit = (dto: CreateSchoolDto): void => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    // TODO: replace with API call — schoolsApi.update(id, dto) or schoolsApi.create(dto)
    setTimeout(() => {
      if (isEdit) {
        console.log('Update school:', id, dto);
        setSuccessMessage('School updated successfully');
      } else {
        console.log('Create school:', dto);
        setSuccessMessage('School created successfully');
      }
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <>
      <PageHeader
        title={isEdit ? 'School Details' : 'Add School'}
        subtitle={isEdit ? school?.schoolCode : 'Create a new school record'}
        actions={
          <Button variant="ghost" onClick={() => void navigate('/admin/schools')}>
            Back to Schools
          </Button>
        }
      />

      <div className="mx-auto max-w-3xl">
        {successMessage && (
          <div
            role="status"
            className="mb-6 rounded-md bg-success-subtle px-4 py-3 text-sm text-success-foreground"
          >
            {successMessage}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <SchoolForm
            initialValues={
              isEdit && school
                ? {
                    schoolCode: school.schoolCode,
                    schoolName: school.schoolName,
                    registrationNo: school.registrationNo,
                    institutionType: school.institutionType,
                    schoolLevel: school.schoolLevel,
                    category: school.category,
                    address: school.address,
                    city: school.city,
                    province: school.province,
                    postalCode: school.postalCode,
                    contactPersonName: school.contactPersonName,
                    contactPersonDesignation: school.contactPersonDesignation,
                    contactEmail: school.contactEmail,
                    contactPhone: school.contactPhone,
                  }
                : undefined
            }
            mode={isEdit ? 'edit' : 'create'}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            onCancel={() => void navigate('/admin/schools')}
          />
        </div>
      </div>
    </>
  );
}

export default SchoolDetailPage;
