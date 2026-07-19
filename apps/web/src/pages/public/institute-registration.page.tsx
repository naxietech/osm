/**
 * Public Institute Registration (open link, no auth). An institute self-registers with
 * its branch, govt code, category (+ the category's dynamic questions), ownership type,
 * education level, gender, address and contacts. Submitting creates a PENDING institute
 * the super admin approves.
 *
 * Thin page: it owns the chrome (header, success screen) + the service call, and
 * delegates the form (fields, validation, category questions) to the
 * InstituteRegistrationForm organism.
 */
import React, { useMemo, useState } from 'react';

import { type RegisterInstituteDto } from '@oses/types';

import { Building2, Check } from '@/design-system/atoms/icon';
import { InstituteRegistrationForm } from '@/design-system/organisms/institute-registration-form';
import { listInstituteCategories } from '@/services/institute-category.service';
import { isInstituteCodeTaken, registerInstitute } from '@/services/institute.service';

export function InstituteRegistrationPage(): React.ReactElement {
  const categories = useMemo(() => listInstituteCategories().filter((c) => c.isActive), []);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const handleSubmit = (dto: RegisterInstituteDto): void => {
    registerInstitute(dto);
    setSubmittedEmail(dto.contactEmail);
  };

  if (submittedEmail) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
          <Check className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold text-foreground">Registration submitted</h1>
        <p className="text-sm text-muted-foreground">
          Thank you. Your institute has been submitted for review. The board will approve your
          registration and get in touch at <span className="font-medium">{submittedEmail}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
          <Building2 className="h-7 w-7" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Institute Registration</h1>
          <p className="text-sm text-muted-foreground">
            Register your institute. The board will review and approve your request.
          </p>
        </div>
      </div>

      <InstituteRegistrationForm
        categories={categories}
        isCodeTaken={isInstituteCodeTaken}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default InstituteRegistrationPage;
