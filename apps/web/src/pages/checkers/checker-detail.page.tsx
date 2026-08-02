/**
 * Checker detail — the ONE record view, reached from both the checkers list and the
 * approvals queue, for ADMIN and INSTITUTE alike.
 *
 * The approve / reject controls are not a property of "the approvals screen": they show
 * whenever the viewer holds `checkers.approve` and the record is still pending. So a
 * super admin opening a checker from the ordinary list can act on it there too, and an
 * institute opening the same page simply doesn't see the controls.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { ChevronLeft } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { Alert } from '@/design-system/molecules/alert';
import { CheckerProfile } from '@/design-system/organisms/checker-profile';
import { usePermissions } from '@/hooks';
import { levelNames, subjectNames } from '@/services/academic.service';
import { approveChecker, getChecker, rejectChecker } from '@/services/checker.service';
import { instituteName } from '@/services/institute.service';

type PendingAction = 'approve' | 'reject';

export function CheckerDetailPage(): React.ReactElement {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const { can, canViewPII } = usePermissions();

  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const checker = getChecker(id);

  if (!checker) {
    return (
      <>
        <PageHeader title="Checker not found" subtitle="This registration no longer exists" />
        <Button variant="ghost" onClick={() => void navigate(-1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Go back
        </Button>
      </>
    );
  }

  const canApprove = can('checkers.approve') && checker.status === 'pending';

  const cancelAction = (): void => {
    setAction(null);
    setReason('');
  };

  const confirmApprove = (): void => {
    approveChecker(checker.id);
    setBanner(
      `${checker.fullName} approved — an Evaluator login was created for ${checker.email}.`,
    );
    cancelAction();
    refresh();
  };

  const confirmReject = (): void => {
    rejectChecker(checker.id, reason);
    setBanner(
      reason.trim().length > 0
        ? `${checker.fullName} rejected — reason recorded.`
        : `${checker.fullName} rejected.`,
    );
    cancelAction();
    refresh();
  };

  return (
    <>
      <PageHeader
        title="Checker"
        subtitle="Registration details"
        actions={
          <Button variant="ghost" onClick={() => void navigate(-1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
        }
      />

      {banner && <Alert className="mb-6">{banner}</Alert>}

      {canApprove && (
        <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          {action === null && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                This registration is awaiting your decision.
              </p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => setAction('approve')}>
                  Approve
                </Button>
                <Button variant="ghost" onClick={() => setAction('reject')}>
                  Reject
                </Button>
              </div>
            </div>
          )}

          {action === 'approve' && (
            <div className="rounded-lg border border-success/30 bg-success-subtle p-4">
              <p className="mb-3 text-sm text-success-foreground">
                Approve {checker.fullName}? This creates an Evaluator login for{' '}
                <span className="font-medium">{checker.email}</span>
                {checker.instituteId ? `, limited to ${instituteName(checker.instituteId)}.` : '.'}
              </p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={confirmApprove}>
                  Confirm approval
                </Button>
                <Button variant="ghost" onClick={cancelAction}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {action === 'reject' && (
            <div className="rounded-lg border border-danger/30 bg-danger-subtle p-4">
              <label htmlFor="reject-reason" className="mb-2 block text-sm text-danger-foreground">
                Why is this registration being rejected? Whoever added it sees this, so they can
                correct it.
              </label>
              <Input
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mb-3 h-11"
              />
              <div className="flex gap-2">
                <Button variant="primary" onClick={confirmReject}>
                  Confirm rejection
                </Button>
                <Button variant="ghost" onClick={cancelAction}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <CheckerProfile
        checker={checker}
        {...(checker.instituteId ? { instituteLabel: instituteName(checker.instituteId) } : {})}
        subjectLabels={subjectNames(checker.subjectIds)}
        levelLabels={levelNames(checker.levelIds)}
        canViewPII={canViewPII}
      />
    </>
  );
}

export default CheckerDetailPage;
