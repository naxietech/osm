/**
 * Add Checker — shared by ADMIN and INSTITUTE.
 *
 * The page decides the binding, not the form: an INSTITUTE user's own institute id is
 * passed as `lockedInstituteId`, which forces the record onto that institute and hides
 * the classification controls entirely. A super admin gets the free choice. Whoever
 * adds it, the record lands pending for approval. Gated by `checkers.manage`.
 */
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { type CreateCheckerDto, UserRole } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Alert } from '@/design-system/molecules/alert';
import { type SelectOption } from '@/design-system/molecules/select-field';
import { CheckerForm } from '@/design-system/organisms/checker-form';
import { useAuth } from '@/hooks';
import { levelSelectOptions, subjects } from '@/services/academic.service';
import { createChecker, isCheckerCnicTaken } from '@/services/checker.service';
import { INSTITUTE_OPTIONS } from '@/services/users.service';

export function CheckerAddPage(): React.ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const base = pathname.slice(0, pathname.indexOf('/checkers') + '/checkers'.length);

  const [banner, setBanner] = useState<string | null>(null);

  const isInstitute = user?.role === UserRole.INSTITUTE;
  const lockedInstituteId = isInstitute ? user?.instituteId : undefined;

  const subjectOptions: SelectOption[] = subjects
    .filter((s) => s.isActive)
    .map((s) => ({ value: s.id, label: s.name }));

  const handleSubmit = (dto: CreateCheckerDto): void => {
    const created = createChecker(dto);
    setBanner(
      `${created.fullName} submitted for approval — reference ${created.checkerRefId}. ` +
        'They cannot sign in until the super admin approves the registration.',
    );
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <PageHeader
        title="Add Checker"
        subtitle={
          isInstitute
            ? 'Register a paper checker for your institute'
            : 'Register a paper checker — general, or bound to one institute'
        }
      />

      {banner && (
        <div className="mb-6">
          <Alert>{banner}</Alert>
          <div className="mt-3">
            <button
              type="button"
              className="text-sm font-medium text-brand hover:underline"
              onClick={() => void navigate(base)}
            >
              Back to checkers
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
        <CheckerForm
          // Remounts after a successful submit so the next registration starts clean.
          key={banner ?? 'new'}
          instituteOptions={INSTITUTE_OPTIONS}
          subjectOptions={subjectOptions}
          levelOptions={levelSelectOptions()}
          {...(lockedInstituteId ? { lockedInstituteId } : {})}
          isCnicTaken={(cnic) => isCheckerCnicTaken(cnic)}
          onSubmit={handleSubmit}
          onCancel={() => void navigate(base)}
        />
      </div>
    </>
  );
}

export default CheckerAddPage;
