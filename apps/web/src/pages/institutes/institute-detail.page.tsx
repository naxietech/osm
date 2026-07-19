/**
 * REFERENCE PAGE PATTERN — InstituteDetailPage
 * Doubles as the create flow (no :id route param) and the edit flow (with :id),
 * both driven by the shared InstituteForm organism. Renders inside the shared role
 * shell with a gradient hero header.
 * TODO: Replace mock data with API calls (findOne in edit mode; create / update on submit).
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  type CreateInstituteDto,
  GenderCategory,
  type Institute,
  InstituteLevel,
  InstitutionType,
  OnboardingStatus,
  Province,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Building2, Check, ChevronLeft } from '@/design-system/atoms/icon';
import { InstituteForm } from '@/design-system/organisms/institute-form';

const MOCK_INSTITUTE: Institute = {
  id: 'sch_001',
  instituteCode: 'LHR-001',
  instituteName: 'Government High School Gulberg',
  registrationNo: 'FBISE-LHR-2019-001',
  institutionType: InstitutionType.GOVERNMENT,
  instituteLevel: InstituteLevel.HIGHER_SECONDARY,
  category: GenderCategory.BOYS,
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

export function InstituteDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // TODO: in edit mode, replace with useQuery(['institute', id], () => institutesApi.findOne(id))
  const institute = isEdit ? MOCK_INSTITUTE : null;

  const handleSubmit = (dto: CreateInstituteDto): void => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    // TODO: replace with API call — institutesApi.update(id, dto) or institutesApi.create(dto)
    setTimeout(() => {
      if (isEdit) {
        console.log('Update institute:', id, dto);
        setSuccessMessage('Institute updated successfully');
      } else {
        console.log('Create institute:', dto);
        setSuccessMessage('Institute created successfully');
      }
      setIsSubmitting(false);
    }, 1000);
  };

  const initials = (institute?.instituteName ?? '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const statusLabel = institute
    ? String(institute.onboardingStatus)
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : '';

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate('/admin/institutes')}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to Institutes
      </Button>

      {/* Gradient hero — institute identity (edit) or create prompt */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-4 bg-brand-gradient px-6 py-6 text-white">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-semibold ring-2 ring-white/25">
            {isEdit && initials ? initials : <Building2 className="h-7 w-7" aria-hidden />}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold">
              {isEdit ? (institute?.instituteName ?? 'Institute') : 'Add Institute'}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {isEdit && institute
                ? `${institute.instituteCode} · ${institute.registrationNo}`
                : 'Create a new institute record'}
            </p>
          </div>

          {isEdit && institute && (
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
        <InstituteForm
          initialValues={
            isEdit && institute
              ? {
                  instituteCode: institute.instituteCode,
                  instituteName: institute.instituteName,
                  registrationNo: institute.registrationNo,
                  institutionType: institute.institutionType,
                  instituteLevel: institute.instituteLevel,
                  category: institute.category,
                  address: institute.address,
                  city: institute.city,
                  province: institute.province,
                  postalCode: institute.postalCode,
                  contactPersonName: institute.contactPersonName,
                  contactPersonDesignation: institute.contactPersonDesignation,
                  contactEmail: institute.contactEmail,
                  contactPhone: institute.contactPhone,
                }
              : undefined
          }
          mode={isEdit ? 'edit' : 'create'}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onCancel={() => void navigate('/admin/institutes')}
        />
      </div>
    </>
  );
}

export default InstituteDetailPage;
