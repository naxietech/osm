/**
 * Institute detail (super admin) — the one screen where an application is decided.
 *
 * Doubles as the create flow when there is no `:id`. In edit mode it carries every action that
 * changes an institute's life: Approve & Register, Reject, Deactivate/Reactivate, and Delete.
 * They live here rather than in the queue or the directory because each needs the whole record
 * in front of you — the government code, the contact number to phone, and the duplicate warning
 * — and because approving mints a login and a permanent institute number.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { CreateInstituteDto, InstituteDetail, UpdateInstituteDto } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Checkbox } from '@/design-system/atoms/checkbox';
import { Building2, ChevronLeft } from '@/design-system/atoms/icon';
import { Label } from '@/design-system/atoms/label';
import { Spinner } from '@/design-system/atoms/spinner';
import { Textarea } from '@/design-system/atoms/textarea';
import { Alert } from '@/design-system/molecules/alert';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { StatusBadge } from '@/design-system/molecules/status-badge';
import { InstituteForm } from '@/design-system/organisms/institute-form';
import { usePermissions } from '@/hooks';
import { useInstituteCategories } from '@/hooks/use-institute-categories';
import {
  useApproveInstitute,
  useCreateInstitute,
  useDeleteInstitute,
  useInstitute,
  useRejectInstitute,
  useSetInstituteStatus,
  useUpdateInstitute,
} from '@/hooks/use-institutes';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';

type Decision = 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'delete' | null;

/** Only the fields the API will accept — the locked ones are absent from the schema entirely. */
function toPatch(dto: CreateInstituteDto): UpdateInstituteDto {
  return {
    instituteName: dto.instituteName,
    branch: dto.branch ?? null,
    institutionType: dto.institutionType,
    address: dto.address,
    city: dto.city,
    province: dto.province,
    postalCode: dto.postalCode ?? null,
    contactPersonName: dto.contactPersonName,
    contactPersonDesignation: dto.contactPersonDesignation,
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
  };
}

export function InstituteDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [createLogin, setCreateLogin] = useState(true);

  /**
   * An Admin holds `institutes.view` but not `institutes.manage`: they can look an institute up
   * while working on students and exams, but approving, deactivating or deleting one is a Super
   * Admin decision. Every control that changes something is withheld rather than disabled — a
   * greyed-out Approve button only invites "why can't I?".
   *
   * This is presentation only. The API refuses the same calls with a 403 regardless.
   */
  const { can } = usePermissions();
  const canManage = can('institutes.manage');

  const instituteQuery = useInstitute(id ?? '', isEdit);
  const institute = instituteQuery.data;

  const approve = useApproveInstitute();
  const reject = useRejectInstitute();
  const setStatus = useSetInstituteStatus();
  const update = useUpdateInstitute();
  const remove = useDeleteInstitute();
  const createInstitute = useCreateInstitute();

  /**
   * Only active categories are offered: a deactivated one is closed to new registrations, and
   * the API refuses it. An institute already filed under one keeps it — the field is locked once
   * the application exists.
   *
   * These come from the API rather than the mock. Offering mock ids would build a request the
   * server rejects with a 400 for a category that does not exist.
   */
  const categoriesQuery = useInstituteCategories();
  // The whole record, not `{value,label}`: the form needs each category's questions to ask them.
  // Passing option pairs is why picking a category showed its name and none of its questions.
  const activeCategories = (categoriesQuery.data ?? []).filter((c) => c.isActive);

  const closeDecision = (): void => {
    setDecision(null);
    setRejectReason('');
  };

  /** Runs an action, showing whatever the server said rather than restating the rule here. */
  const run = async (work: () => Promise<{ message: string }>): Promise<void> => {
    setActionError(null);
    try {
      const { message } = await work();
      setBanner(message);
      closeDecision();
    } catch (err) {
      setActionError(apiErrorMessage(err));
      closeDecision();
    }
  };

  const handleSubmit = (dto: CreateInstituteDto): void => {
    setActionError(null);
    if (isEdit && id) {
      void update
        .mutateAsync({ id, dto: toPatch(dto) })
        .then(() => setBanner('Institute updated.'))
        .catch((err: unknown) => setActionError(apiErrorMessage(err)));
      return;
    }
    // Through the hook, not the service directly: every other mutation on this page invalidates
    // the institutes cache on success, and a create that skipped it would leave the directory
    // and the approval queue serving a page that omits the new record.
    void createInstitute
      .mutateAsync(dto)
      .then((result) =>
        navigate(`${ROUTES.admin.institutes}/${result.institute.id}`, {
          replace: true,
          // The API's own wording, which says whether the login was created — restating it here
          // would go stale the moment that behaviour changes, and it just did.
          state: { notice: result.message },
        }),
      )
      .catch((err: unknown) => setActionError(apiErrorMessage(err)));
  };

  if (isEdit && instituteQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isEdit && (instituteQuery.isError || !institute)) {
    return (
      <>
        <Alert tone="danger" className="mb-4">
          {instituteQuery.isError ? apiErrorMessage(instituteQuery.error) : 'Institute not found'}
        </Alert>
        <Button variant="ghost" onClick={() => void navigate(ROUTES.admin.institutes)}>
          Back to institutes
        </Button>
      </>
    );
  }

  const displayName = institute
    ? [institute.instituteName, institute.branch].filter(Boolean).join(', ')
    : 'New institute';

  return (
    <>
      <Header institute={institute} displayName={displayName} onBack={() => void navigate(-1)} />

      {banner && (
        <Alert tone="success" className="mb-4" onDismiss={() => setBanner(null)}>
          {banner}
        </Alert>
      )}
      {categoriesQuery.isError && (
        <Alert tone="danger" className="mb-4">
          {apiErrorMessage(categoriesQuery.error)}
        </Alert>
      )}

      {actionError && (
        <Alert
          tone="danger"
          className="mb-4"
          onDismiss={() => setActionError(null)}
          dismissLabel="Dismiss error"
        >
          {actionError}
        </Alert>
      )}

      {institute && institute.possibleDuplicates.length > 0 && (
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

      {institute?.status === 'rejected' && institute.rejectionReason && (
        <Alert tone="danger" className="mb-4">
          <span className="font-medium">Rejected.</span> {institute.rejectionReason}
        </Alert>
      )}

      {institute?.status === 'pending' && canManage && (
        <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
          <Button variant="primary" onClick={() => setDecision('approve')}>
            Approve &amp; Register
          </Button>
          <Button variant="ghost" onClick={() => setDecision('reject')}>
            Reject
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
        <InstituteForm
          categories={activeCategories}
          readOnly={!canManage}
          initialValues={
            isEdit && institute
              ? {
                  instituteCode: institute.instituteCode,
                  instituteName: institute.instituteName,
                  categoryId: institute.categoryId,
                  institutionType: institute.institutionType,
                  address: institute.address,
                  city: institute.city,
                  province: institute.province,
                  contactPersonName: institute.contactPersonName,
                  contactPersonDesignation: institute.contactPersonDesignation,
                  contactEmail: institute.contactEmail,
                  contactPhone: institute.contactPhone,
                  ...(institute.branch ? { branch: institute.branch } : {}),
                  ...(institute.postalCode ? { postalCode: institute.postalCode } : {}),
                }
              : undefined
          }
          {...(isEdit && canManage ? { onDelete: () => setDecision('delete') } : {})}
          onSubmit={handleSubmit}
          onCancel={() => void navigate(ROUTES.admin.institutes)}
          isSubmitting={update.isPending || createInstitute.isPending}
          mode={isEdit ? 'edit' : 'create'}
        />

        {isEdit && canManage && (
          <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
            Changing the contact email here does <strong>not</strong> change any login. Recommended:
            also change the login email for this institute on the Users screen.
          </p>
        )}
      </div>

      {institute &&
        canManage &&
        institute.status !== 'pending' &&
        institute.status !== 'rejected' && (
          <div className="mt-6 rounded-lg border border-danger/40 bg-danger-subtle/30 p-6">
            <h2 className="text-sm font-semibold text-foreground">
              {institute.status === 'approved'
                ? 'Deactivate this institute'
                : 'This institute is off'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {institute.status === 'approved'
                ? "Deactivating stops the institute's accounts signing in and blocks it from future exams. An exam already running is not disturbed, and results are never affected. It can be switched back on."
                : 'Its accounts cannot sign in. Reactivating opens the institute again, but each account has to be switched back on individually — one may have been disabled for its own reasons.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant={institute.status === 'approved' ? 'danger' : 'primary'}
                onClick={() =>
                  setDecision(institute.status === 'approved' ? 'deactivate' : 'reactivate')
                }
              >
                {institute.status === 'approved' ? 'Deactivate' : 'Reactivate'}
              </Button>
              <Button variant="ghost" onClick={() => setDecision('delete')}>
                Delete
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Delete is only possible while nothing is attached — no accounts, students or exams.
            </p>
          </div>
        )}

      {/* ---- decisions ---- */}

      <ConfirmDialog
        open={decision === 'approve'}
        onClose={closeDecision}
        onConfirm={() =>
          void run(async () => {
            const result = await approve.mutateAsync({ id: id ?? '', dto: { createLogin } });
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
              <span className="font-medium">{institute?.contactEmail}</span>, using the password
              chosen at registration. Untick if this institute&rsquo;s accounts are managed
              separately.
            </span>
          }
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={decision === 'reject'}
        onClose={closeDecision}
        onConfirm={() => void run(() => reject.mutateAsync({ id: id ?? '', reason: rejectReason }))}
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
        open={decision === 'reactivate'}
        onClose={closeDecision}
        onConfirm={() =>
          void run(() => setStatus.mutateAsync({ id: id ?? '', status: 'approved' }))
        }
        title={`Reactivate ${displayName}?`}
        description="The institute can be used again. Its accounts stay switched off until you re-enable each one on the Users screen."
        confirmLabel="Reactivate"
        busy={setStatus.isPending}
      />

      <ConfirmDialog
        open={decision === 'delete'}
        onClose={closeDecision}
        onConfirm={() =>
          void run(async () => {
            const result = await remove.mutateAsync(id ?? '');
            void navigate(ROUTES.admin.institutes, { state: { notice: result.message } });
            return result;
          })
        }
        title={`Delete ${displayName}?`}
        description="Only possible while nothing is attached. The record is kept for the audit trail, but the institute code is freed so it can be registered again correctly."
        confirmLabel="Delete institute"
        tone="danger"
        busy={remove.isPending}
      />
    </>
  );
}

function Header({
  institute,
  displayName,
  onBack,
}: {
  institute: InstituteDetail | undefined;
  displayName: string;
  onBack: () => void;
}): React.ReactElement {
  return (
    <div className="mb-6 rounded-xl bg-gradient-to-r from-primary to-primary/80 p-6 text-white md:p-8">
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
              {institute
                ? [
                    institute.instituteCode,
                    institute.numericCode === null
                      ? 'no number yet'
                      : `No. ${String(institute.numericCode).padStart(4, '0')}`,
                  ].join(' · ')
                : 'Create a new institute record'}
            </p>
          </div>
        </div>
        {institute && <StatusBadge status={institute.status} />}
      </div>
    </div>
  );
}

export default InstituteDetailPage;
