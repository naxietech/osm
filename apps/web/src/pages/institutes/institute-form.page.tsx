/**
 * Add or edit an institute — the only screen with an editable institute form.
 *
 * Split out from the detail screen, which now only shows. Reading a record and changing one are
 * different jobs: a reviewer deciding whether to approve an application was previously reading it
 * out of input boxes with a Save button in reach, and the lifecycle actions (approve, reject,
 * deactivate) sat on the same page as an unsaved form.
 *
 * What lives here is only what editing needs: the form, and Delete — which is an edit-mode
 * action because deleting is the end of the same record you are editing. Approve, Reject and
 * Deactivate stay on the detail screen, where the whole record is in front of you.
 *
 * Gated by `institutes.manage`; a caller without it is sent to the read-only screen.
 */
import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import type { CreateInstituteDto, UpdateInstituteDto } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Building2, ChevronLeft } from '@/design-system/atoms/icon';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { ConfirmDialog } from '@/design-system/molecules/modal';
import { useToast } from '@/design-system/molecules/toast';
import { InstituteForm } from '@/design-system/organisms/institute-form';
import { usePermissions } from '@/hooks';
import { useInstituteCategories } from '@/hooks/use-institute-categories';
import {
  useCreateInstitute,
  useDeleteInstitute,
  useInstitute,
  useUpdateInstitute,
} from '@/hooks/use-institutes';
import { ROUTES } from '@/router/routes';
import { apiErrorMessage } from '@/services/api-client';

/**
 * Only the fields the API will accept — the locked ones (`instituteCode`, `categoryId`,
 * `numericCode`, `status`) are absent from the update schema entirely, and sending one answers
 * 400 naming it.
 *
 * `answers` is forwarded only when the form supplied it. The API reads an omitted `answers` as
 * "leave them alone" and an empty array as "clear them", so passing `undefined` through as `[]`
 * would wipe what the institute declared on any edit that never touched the questions.
 */
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
    ...(dto.answers !== undefined ? { answers: dto.answers } : {}),
  };
}

export function InstituteFormPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const toast = useToast();

  const { can } = usePermissions();
  const canManage = can('institutes.manage');

  const instituteQuery = useInstitute(id ?? '', isEdit);
  const institute = instituteQuery.data;

  const categoriesQuery = useInstituteCategories();
  // Only active categories are offered: a deactivated one is closed to new registrations and the
  // API refuses it. An institute already filed under one keeps it — the field is locked on edit.
  const activeCategories = (categoriesQuery.data ?? []).filter((c) => c.isActive);

  const create = useCreateInstitute();
  const update = useUpdateInstitute();
  const remove = useDeleteInstitute();

  const detailPath = id ? `${ROUTES.admin.institutes}/${id}` : ROUTES.admin.institutesView;

  const handleSubmit = (dto: CreateInstituteDto): void => {
    if (isEdit && id) {
      void update
        .mutateAsync({ id, dto: toPatch(dto) })
        .then(() => {
          // The toast provider is above the router, so this survives the navigation below and
          // is read on the screen the editor lands on.
          toast.success('Institute updated.');
          navigate(detailPath, { replace: true });
        })
        .catch((err: unknown) => toast.error(apiErrorMessage(err)));
      return;
    }

    void create
      .mutateAsync(dto)
      .then((result) => {
        // The API's own wording, which says whether a login was created alongside the record.
        toast.success(result.message);
        navigate(`${ROUTES.admin.institutes}/${result.institute.id}`, { replace: true });
      })
      .catch((err: unknown) => toast.error(apiErrorMessage(err)));
  };

  const handleDelete = (): void => {
    if (!id) return;
    void remove
      .mutateAsync(id)
      .then(() => {
        toast.success('Institute deleted.');
        navigate(ROUTES.admin.institutesView, { replace: true });
      })
      // The API refuses while anything is attached, and says what — do not restate it here.
      .catch((err: unknown) => toast.error(apiErrorMessage(err)))
      .finally(() => setConfirmingDelete(false));
  };

  // Editing is a capability, not a view. Sending a view-only caller to the read-only screen is
  // clearer than rendering a form every control of which is disabled.
  if (!canManage) return <Navigate to={detailPath} replace />;

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
        <Button variant="ghost" onClick={() => void navigate(ROUTES.admin.institutesView)}>
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
      <div className="mb-6 rounded-xl bg-brand-gradient p-6 text-white md:p-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate(-1)}
          className="mb-4 text-white hover:bg-white/10"
        >
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
          Back
        </Button>
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-8 w-8 shrink-0" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold md:text-2xl">
              {isEdit ? `Edit ${displayName}` : 'Add Institute'}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {isEdit
                ? 'The institute code, category and registration answers are fixed once registered.'
                : 'Registers the institute and, with a password, its login in one step.'}
            </p>
          </div>
        </div>
      </div>

      {categoriesQuery.isError && (
        <Alert tone="danger" className="mb-4">
          {apiErrorMessage(categoriesQuery.error)}
        </Alert>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
        <InstituteForm
          categories={activeCategories}
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
                  // Seeds the question fields with what the institute declared. Saving replaces
                  // the whole set, so what comes back out is what will be stored.
                  answers: institute.answers,
                  ...(institute.branch ? { branch: institute.branch } : {}),
                  ...(institute.postalCode ? { postalCode: institute.postalCode } : {}),
                }
              : undefined
          }
          {...(isEdit ? { onDelete: () => setConfirmingDelete(true) } : {})}
          onSubmit={handleSubmit}
          onCancel={() => void navigate(detailPath)}
          isSubmitting={update.isPending || create.isPending}
          mode={isEdit ? 'edit' : 'create'}
        />

        {isEdit && (
          <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
            Changing the contact email here does <strong>not</strong> change any login. Recommended:
            also change the login email for this institute on the Users screen.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
        title={`Delete ${displayName}?`}
        description="This removes the institute outright and cannot be undone. It is refused while anything is attached — accounts, students or exams. Deactivate it instead to switch it off reversibly."
        confirmLabel="Delete institute"
        tone="danger"
        busy={remove.isPending}
      />
    </>
  );
}

export default InstituteFormPage;
