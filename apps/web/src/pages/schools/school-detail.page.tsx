/**
 * REFERENCE PAGE PATTERN — SchoolDetailPage
 * Doubles as the create flow (no :id route param) and the edit flow (with :id),
 * both driven by the shared SchoolForm organism. Renders inside the shared role
 * shell with a gradient hero header.
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

import { Button } from '@/design-system/atoms/button';
import { Building2, Check, ChevronLeft } from '@/design-system/atoms/icon';
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

  const initials = (school?.schoolName ?? '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const statusLabel = school
    ? String(school.onboardingStatus)
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : '';

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate('/admin/schools')}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to Schools
      </Button>

      {/* Gradient hero — school identity (edit) or create prompt */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-4 bg-brand-gradient px-6 py-6 text-white">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-semibold ring-2 ring-white/25">
            {isEdit && initials ? initials : <Building2 className="h-7 w-7" aria-hidden />}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold">
              {isEdit ? (school?.schoolName ?? 'School') : 'Add School'}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {isEdit && school
                ? `${school.schoolCode} · ${school.registrationNo}`
                : 'Create a new school record'}
            </p>
          </div>

          {isEdit && school && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25">
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-sm font-medium text-success-foreground"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
          {successMessage}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
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
    </>
  );
}

export default SchoolDetailPage;
