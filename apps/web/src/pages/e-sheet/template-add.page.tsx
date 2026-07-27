/**
 * TemplateAddPage — create one e-sheet template (ADMIN and CONTROLLER).
 *
 * Mounted under /admin/e-sheet/add-template and /controller/e-sheet/add-template, so the
 * return path is derived from the URL (role-agnostic), matching ExamsListPage. Create only:
 * editing happens inline on the templates list, so there is no :id route to reach here.
 *
 * The page composes the form and the preview side by side and owns the draft that passes
 * between them — an organism may not import another organism, so this is where they meet.
 *
 * TODO: Replace the eSheetTemplateService calls with React Query mutations.
 */
import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import type { CreateESheetTemplateDto, ESheetTemplate } from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { ESheetPreview } from '@/design-system/organisms/e-sheet-preview';
import { ESheetTemplateForm } from '@/design-system/organisms/e-sheet-template-form';
import { usePermissions } from '@/hooks';
import { eSheetTemplateService } from '@/services/e-sheet-template.service';

export function TemplateAddPage(): React.ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canManageTemplates } = usePermissions();

  // e.g. "/admin/e-sheet/add-template" -> "/admin/e-sheet"
  const base = pathname.slice(0, pathname.indexOf('/e-sheet') + '/e-sheet'.length);
  const listPath = `${base}/view-template`;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<ESheetTemplate | null>(null);

  const handleDraftChange = useCallback((template: ESheetTemplate) => setDraft(template), []);

  const handleSave = (dto: CreateESheetTemplateDto): void => {
    setIsSubmitting(true);
    setSubmitError(undefined);
    void eSheetTemplateService
      .createTemplate(dto)
      .then(() => {
        setIsSubmitting(false);
        void navigate(listPath);
      })
      .catch((error: unknown) => {
        setIsSubmitting(false);
        setSubmitError(error instanceof Error ? error.message : 'Could not save the template');
      });
  };

  if (!canManageTemplates) {
    return (
      <>
        <PageHeader title="Add Template" />
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          You do not have permission to create e-sheet templates.
        </div>
      </>
    );
  }

  const hasQuestions = (draft?.questions.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Add Template"
        subtitle="Describe a paper's questions once; the pages, page numbers and crop areas are worked out for you"
      />

      {/* Side by side only from 2xl up. Splitting a small laptop in two left the form about
          500px wide, which squeezed every field row — below that the sheet sits under the form,
          where it still gets its full width. */}
      <div className="grid gap-6 2xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6 print:hidden">
          <ESheetTemplateForm
            mode="create"
            isNameTaken={(name) => eSheetTemplateService.isTemplateNameTaken(name)}
            onSave={handleSave}
            onCancel={() => void navigate(listPath)}
            onDraftChange={handleDraftChange}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between print:hidden">
            <h2 className="text-sm font-semibold text-foreground">Printed sheet preview</h2>
            {hasQuestions && (
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                Download PDF
              </Button>
            )}
          </div>
          <ESheetPreview template={hasQuestions ? draft : null} />
        </div>
      </div>
    </>
  );
}

export default TemplateAddPage;
