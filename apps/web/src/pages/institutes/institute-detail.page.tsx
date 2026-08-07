/**
 * Institute detail (super admin) — the record, and the decisions taken against it.
 *
 * **Read-only by design.** It used to render the editable form, so a reviewer deciding whether to
 * approve an application was reading it out of input boxes with a Save button in reach of a
 * decision that has nothing to do with saving. Editing moved to its own screen; this one shows
 * the record and carries the actions that change its life.
 *
 * Which actions appear follows the status, and nothing else:
 *
 * - **pending** — Approve & Register, Reject. Nothing else: an application cannot be edited,
 *   deactivated or deleted, because none of those mean anything before it exists as an institute.
 * - **approved / deactivated** — Edit, and Deactivate or Reactivate.
 * - **rejected** — Delete, and only here. A turned-away application is the one state with no
 *   dependants by definition and no operational meaning left, so clearing it is safe; it is also
 *   the state that accumulates. The delete is **soft** — the row survives with `deleted_at`, which
 *   is what keeps the record of who applied and what freed their institute code.
 *
 * For a live institute, Delete lives on the edit screen, not here. Approving mints a login and a permanent institute
 * number, so it is deliberately two clicks from the queue: this screen, then a confirmation.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { InstituteDetail } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Checkbox } from '@/design-system/atoms/checkbox';
import { Ban, Building2, ChevronLeft, Pencil, Trash2, Undo2 } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { Label } from '@/design-system/atoms/label';
import { Spinner } from '@/design-system/atoms/spinner';
import { Textarea } from '@/design-system/atoms/textarea';
import { Alert } from '@/design-system/molecules/alert';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { StatusBadge } from '@/design-system/molecules/status-badge';
import { useToast } from '@/design-system/molecules/toast';
import { InstituteSummary } from '@/design-system/organisms/institute-summary';
import { usePermissions } from '@/hooks';
import { useInstituteCategories } from '@/hooks/use-institute-categories';
import {
  useApproveInstitute,
  useDeleteInstitute,
  useInstitute,
  useRejectInstitute,
  useSetInstituteStatus,
} from '@/hooks/use-institutes';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';

type Decision = 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'delete' | null;

export function InstituteDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [decision, setDecision] = useState<Decision>(null);
  const [createLogin, setCreateLogin] = useState(true);
  const [rejectReason, setRejectReason] = useState('');

  const { can } = usePermissions();
  const canManage = can('institutes.manage');

  const instituteQuery = useInstitute(id ?? '', Boolean(id));
  const institute = instituteQuery.data;

  // Named categories and labelled answers. The summary degrades to the raw id while this loads
  // rather than showing a blank where a category name belongs.
  const categoriesQuery = useInstituteCategories();

  const approve = useApproveInstitute();
  const reject = useRejectInstitute();
  const setStatus = useSetInstituteStatus();
  const remove = useDeleteInstitute();

  const closeDecision = (): void => {
    setDecision(null);
    setRejectReason('');
  };

  /** Runs an action, showing whatever the server said rather than restating the rule here. */
  const run = async (work: () => Promise<{ message: string }>): Promise<void> => {
    try {
      const { message } = await work();
      toast.success(message);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      closeDecision();
    }
  };

  if (instituteQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (instituteQuery.isError || !institute) {
    return (
      <>
        <Alert tone="danger" className="mb-4">
          {instituteQuery.isError ? apiErrorMessage(instituteQuery.error) : 'Institute not found'}
        </Alert>
        <Button variant="ghost" onClick={() => void navigate(ROUTES.admin.institutesView)}>
          Back to institutes
        </Button>
      </>
    );
  }

  const displayName = [institute.instituteName, institute.branch].filter(Boolean).join(', ');
  const isLive = institute.status === 'approved' || institute.status === 'deactivated';

  return (
    <>
      <Header
        institute={institute}
        displayName={displayName}
        onBack={() => void navigate(-1)}
        actions={
          canManage && institute.status === 'rejected' ? (
            <IconButton
              tone="danger"
              label={`Delete the application from ${displayName}`}
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
              onClick={() => setDecision('delete')}
            />
          ) : canManage && isLive ? (
            <div className="flex gap-2">
              <IconButton
                label={`Edit ${displayName}`}
                icon={<Pencil className="h-4 w-4" aria-hidden />}
                onClick={() => void navigate(`${ROUTES.admin.institutes}/${institute.id}/edit`)}
              />
              <IconButton
                tone={institute.status === 'approved' ? 'danger' : 'default'}
                label={`${institute.status === 'approved' ? 'Deactivate' : 'Reactivate'} ${displayName}`}
                icon={
                  institute.status === 'approved' ? (
                    <Ban className="h-4 w-4" aria-hidden />
                  ) : (
                    <Undo2 className="h-4 w-4" aria-hidden />
                  )
                }
                onClick={() =>
                  setDecision(institute.status === 'approved' ? 'deactivate' : 'reactivate')
                }
              />
            </div>
          ) : null
        }
      />

      {/* Stays an Alert, not a toast: it sits beside the record it warns about and must still be
          on screen when the reviewer decides. A message that vanishes after five seconds cannot
          be the only place a duplicate was mentioned. */}
      {institute.possibleDuplicates.length > 0 && (
        <Alert tone="warning" className="mb-4">
          <span className="font-medium">Possible duplicate.</span> Another institute is already
          registered as &ldquo;{institute.instituteName}&rdquo; in {institute.city}
          {institute.possibleDuplicates.length > 1
            ? ` (${institute.possibleDuplicates.length} of them)`
            : ''}
          . Two institutes can genuinely share a name, so check the government code before
          approving.
        </Alert>
      )}

      {institute.status === 'rejected' && institute.rejectionReason && (
        <Alert tone="danger" className="mb-4">
          <span className="font-medium">Rejected.</span> {institute.rejectionReason}
        </Alert>
      )}

      {institute.status === 'pending' && canManage && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
          <Button variant="primary" onClick={() => setDecision('approve')}>
            Approve &amp; Register
          </Button>
          <Button variant="ghost" onClick={() => setDecision('reject')}>
            Reject
          </Button>
          <p className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
            Approving draws a permanent institute number and cannot be undone — a mistake is
            corrected by deactivating, not by un-approving.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
        <InstituteSummary institute={institute} categories={categoriesQuery.data ?? []} />
      </div>

      {/* ---- decisions ---- */}

      <ConfirmDialog
        open={decision === 'approve'}
        onClose={closeDecision}
        onConfirm={() =>
          void run(async () => {
            const result = await approve.mutateAsync({ id: id ?? '', dto: { createLogin } });
            // Back to the queue: the reviewer's next act is almost always the next application,
            // and this one is no longer in it. The toast outlives the navigation, so the
            // confirmation is read on the screen they land on.
            void navigate(ROUTES.admin.instituteApprovals);
            return { message: result.message };
          })
        }
        title={`Approve ${displayName}?`}
        description="The institute is approved and given its permanent number. This cannot be undone — a mistake is corrected by deactivating, not by un-approving."
        confirmLabel="Approve & Register"
        busy={approve.isPending}
      >
        <Checkbox
          checked={createLogin}
          onChange={(e) => setCreateLogin(e.target.checked)}
          className="mt-0.5"
          labelClassName="w-full items-start"
          label={
            <span>
              Also create the login for{' '}
              <span className="font-medium">{institute.contactEmail}</span>, using the password
              chosen at registration. Untick if this institute&rsquo;s accounts are managed
              separately.
            </span>
          }
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={decision === 'reject'}
        onClose={closeDecision}
        onConfirm={() =>
          void run(async () => {
            const result = await reject.mutateAsync({ id: id ?? '', reason: rejectReason });
            void navigate(ROUTES.admin.instituteApprovals);
            return result;
          })
        }
        title={`Reject ${displayName}?`}
        description="The application is kept with its reason, and the institute code is freed so they can apply again. There is no email service — telling them is a phone call."
        confirmLabel="Reject application"
        tone="danger"
        busy={reject.isPending}
        confirmDisabled={rejectReason.trim().length === 0}
      >
        <Label htmlFor="reject-reason" className="mb-1.5">
          Reason
        </Label>
        <Textarea
          id="reject-reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="e.g. The government code does not match board records"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={decision === 'deactivate'}
        onClose={closeDecision}
        onConfirm={() =>
          void run(() => setStatus.mutateAsync({ id: id ?? '', status: 'deactivated' }))
        }
        title={`Deactivate ${displayName}?`}
        description="Its accounts are signed out immediately and cannot sign back in. Students and evaluators are switched off too. Results are not affected, and this can be reversed."
        confirmLabel="Deactivate"
        tone="danger"
        busy={setStatus.isPending}
      />

      <ConfirmDialog
        open={decision === 'delete'}
        onClose={closeDecision}
        onConfirm={() =>
          void run(async () => {
            const result = await remove.mutateAsync(id ?? '');
            void navigate(ROUTES.admin.institutesView);
            return result;
          })
        }
        title={`Delete the application from ${displayName}?`}
        description="It disappears from the directory. The record itself is kept — who applied, when, and why they were turned away — so nothing about the decision is lost. The institute code stays free either way; rejecting is what released it."
        confirmLabel="Delete application"
        tone="danger"
        busy={remove.isPending}
      />

      <ConfirmDialog
        open={decision === 'reactivate'}
        onClose={closeDecision}
        onConfirm={() =>
          void run(() => setStatus.mutateAsync({ id: id ?? '', status: 'approved' }))
        }
        title={`Reactivate ${displayName}?`}
        description="The institute is open again. Each of its accounts still has to be switched back on individually — one may have been disabled for its own reasons."
        confirmLabel="Reactivate"
        busy={setStatus.isPending}
      />
    </>
  );
}

function Header({
  institute,
  displayName,
  onBack,
  actions,
}: {
  institute: InstituteDetail;
  displayName: string;
  onBack: () => void;
  actions: React.ReactNode;
}): React.ReactElement {
  // `bg-brand-gradient`, not `from-primary`: there is no `primary` colour token in this theme, so
  // Tailwind emitted no background at all and this block rendered as a blank box with
  // white-on-white text — read on screen as empty space above the content.
  return (
    <div className="mb-6 rounded-xl bg-brand-gradient p-6 text-white md:p-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-4 text-white hover:bg-white/10"
      >
        <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
        Back
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-8 w-8 shrink-0" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold md:text-2xl">{displayName}</h1>
            <p className="mt-1 text-sm text-white/80">
              {[
                institute.instituteCode,
                institute.numericCode === null
                  ? 'no number yet'
                  : `No. ${String(institute.numericCode).padStart(4, '0')}`,
              ].join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <StatusBadge status={institute.status} />
        </div>
      </div>
    </div>
  );
}

export default InstituteDetailPage;
