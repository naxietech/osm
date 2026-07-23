/**
 * The checker's own registration record.
 *
 * Reuses the CheckerProfile organism that the admin and institute detail pages render,
 * so there is one definition of what a checker record looks like. `canViewPII` is true
 * here — the PII being withheld elsewhere is this person's own, and hiding someone's own
 * CNIC from them protects nobody.
 */
import React from 'react';

import { PageHeader } from '@/components/widgets';
import { CheckerProfile } from '@/design-system/organisms/checker-profile';
import { useCurrentChecker } from '@/hooks';
import { levelNames, subjectNames } from '@/services/academic.service';
import { instituteName } from '@/services/users.service';

export function EvaluatorProfilePage(): React.ReactElement {
  const checker = useCurrentChecker();

  if (!checker) {
    return (
      <PageHeader
        title="Profile unavailable"
        subtitle="No checker registration is linked to this login."
      />
    );
  }

  return (
    <>
      <PageHeader title="Profile" subtitle="Your registration record" />

      <CheckerProfile
        checker={checker}
        {...(checker.instituteId ? { instituteLabel: instituteName(checker.instituteId) } : {})}
        subjectLabels={subjectNames(checker.subjectIds)}
        levelLabels={levelNames(checker.levelIds)}
        canViewPII
      />
    </>
  );
}

export default EvaluatorProfilePage;
