/**
 * REFERENCE PATTERN — SchoolForm (organism)
 * This is the reference for all future domain forms.
 * Pattern: controlled form with local state, onSubmit prop, isSubmitting prop.
 * TODO: Add React Hook Form + Zod validation in next phase.
 */
import React, { useState } from 'react';

import { Button } from '@/design-system/atoms/button';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';

import type { CreateSchoolDto } from '@oses/types';

export interface SchoolFormProps {
  initialValues?: Partial<CreateSchoolDto>;
  onSubmit: (data: CreateSchoolDto) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

interface FormErrors {
  schoolCode?: string;
  schoolName?: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export function SchoolForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  mode,
}: SchoolFormProps): React.ReactElement {
  const [schoolCode, setSchoolCode] = useState(initialValues?.schoolCode ?? '');
  const [schoolName, setSchoolName] = useState(initialValues?.schoolName ?? '');
  const [city, setCity] = useState(initialValues?.city ?? '');
  const [contactEmail, setContactEmail] = useState(initialValues?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(initialValues?.contactPhone ?? '');
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!schoolCode.trim()) nextErrors.schoolCode = 'School code is required';
    if (!schoolName.trim()) nextErrors.schoolName = 'School name is required';
    if (!city.trim()) nextErrors.city = 'City is required';
    if (!contactEmail.trim()) nextErrors.contactEmail = 'Contact email is required';
    if (!contactPhone.trim()) nextErrors.contactPhone = 'Contact phone is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ schoolCode, schoolName, city, contactEmail, contactPhone });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid gap-6 md:grid-cols-2">
        <FormField id="schoolCode" label="School Code" error={errors.schoolCode} required>
          <Input
            id="schoolCode"
            name="schoolCode"
            value={schoolCode}
            onChange={(e) => setSchoolCode(e.target.value)}
            error={!!errors.schoolCode}
            disabled={mode === 'edit'}
            placeholder="e.g. LHR-001"
          />
        </FormField>

        <FormField id="schoolName" label="School Name" error={errors.schoolName} required>
          <Input
            id="schoolName"
            name="schoolName"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            error={!!errors.schoolName}
            placeholder="Full school name"
          />
        </FormField>

        <FormField id="city" label="City" error={errors.city} required>
          <Input
            id="city"
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            error={!!errors.city}
            placeholder="e.g. Lahore"
          />
        </FormField>

        <FormField id="contactEmail" label="Contact Email" error={errors.contactEmail} required>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            error={!!errors.contactEmail}
            placeholder="principal@school.edu.pk"
          />
        </FormField>

        <FormField id="contactPhone" label="Contact Phone" error={errors.contactPhone} required>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            error={!!errors.contactPhone}
            placeholder="+92-42-35761234"
          />
        </FormField>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === 'create' ? 'Create School' : 'Save Changes'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default SchoolForm;
