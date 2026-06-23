/**
 * REFERENCE PATTERN — SchoolForm (organism)
 * This is the reference for all future domain forms.
 * Pattern: controlled form with local state, onSubmit prop, isSubmitting prop.
 * TODO: Add React Hook Form + Zod validation in next phase.
 */
import React, { useState } from 'react';

import type { CreateSchoolDto } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';

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
        <FormField
          id="schoolCode"
          name="schoolCode"
          label="School Code"
          value={schoolCode}
          onChange={(e) => setSchoolCode(e.target.value)}
          error={errors.schoolCode}
          disabled={mode === 'edit'}
          required
        />

        <FormField
          id="schoolName"
          name="schoolName"
          label="School Name"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          error={errors.schoolName}
          required
        />

        <FormField
          id="city"
          name="city"
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={errors.city}
          required
        />

        <FormField
          id="contactEmail"
          name="contactEmail"
          type="email"
          label="Contact Email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          error={errors.contactEmail}
          required
        />

        <FormField
          id="contactPhone"
          name="contactPhone"
          type="tel"
          label="Contact Phone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          error={errors.contactPhone}
          required
        />
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
