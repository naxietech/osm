/**
 * TemplatesListPage — every e-sheet template (ADMIN and CONTROLLER).
 *
 * Mounted under /admin/e-sheet/view-template and /controller/e-sheet/view-template, so the
 * "Add Template" link is derived from the URL (role-agnostic), matching ExamsListPage.
 *
 * Clicking a row shows that template's printed sheet. Editing opens the form with a live
 * preview beside it (the SloPage inline pattern) rather than on a separate route — templates
 * have no :id route, and the list is the natural place to compare one against the others.
 * This page owns the draft that passes between the form and the preview, because an organism
 * may not import another organism.
 *
 * Deleting asks first, in an inline strip (the ReferenceCrud pattern). A template can be
 * deactivated instead, which keeps it for reference but hides it from new e-sheets.
 *
 * TODO: Replace the eSheetTemplateService calls with React Query.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  type CreateESheetTemplateDto,
  DEFAULT_ANSWER_SPACE,
  DEFAULT_MCQ_OPTION_COUNT,
  type ESheetTemplate,
  type ESheetTemplateListItem,
} from '@oses/types';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Alert } from '@/design-system/molecules/alert';
import { ActiveBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { ESheetPreview } from '@/design-system/organisms/e-sheet-preview';
import {
  ESheetTemplateForm,
  type ESheetTemplateFormValue,
} from '@/design-system/organisms/e-sheet-template-form';
import { usePermissions } from '@/hooks';
import { eSheetTemplateService } from '@/services/e-sheet-template.service';

/** Turn a stored template into the form's all-strings draft. */
function toFormValue(template: ESheetTemplate): ESheetTemplateFormValue {
  return {
    name: template.name,
    instructions: template.instructions ?? '',
    questions: template.questions.map((question) => ({
      questionNo: String(question.questionNo),
      type: question.type,
      optionCount: String(question.optionCount ?? DEFAULT_MCQ_OPTION_COUNT),
      subPartLabelStyle: question.subPartLabelStyle ?? 'alpha',
      defaultSpace: question.defaultSpace ?? DEFAULT_ANSWER_SPACE,
      subPartCount: String(question.answers.length),
      answers: question.answers.map((answer) => ({
        // A stored answer with no space of its own falls back to its question's.
        space: answer.space ?? question.defaultSpace ?? DEFAULT_ANSWER_SPACE,
        maxMarks: String(answer.maxMarks),
      })),
    })),
  };
}

export function TemplatesListPage(): React.ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canManageTemplates } = usePermissions();

  // e.g. "/admin/e-sheet/view-template" -> "/admin/e-sheet"
  const base = pathname.slice(0, pathname.indexOf('/e-sheet') + '/e-sheet'.length);

  const [templates, setTemplates] = useState<ESheetTemplateListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string; value: ESheetTemplateFormValue } | null>(
    null,
  );
  /** The sheet on show — the saved template when viewing, the live draft when editing. */
  const [preview, setPreview] = useState<ESheetTemplate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ESheetTemplateListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const load = useCallback((): Promise<void> => {
    return eSheetTemplateService.listTemplates().then((rows) => {
      setTemplates(rows);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDraftChange = useCallback((template: ESheetTemplate) => setPreview(template), []);

  /** Report a rejected service call instead of leaving the screen silently unchanged. */
  const fail = (fallback: string) => (cause: unknown) => {
    setIsSubmitting(false);
    setError(cause instanceof Error ? cause.message : fallback);
  };

  const closeEditor = (): void => {
    setEditing(null);
    setPreview(null);
    setSubmitError(undefined);
  };

  const clearMessages = (): void => {
    setNotice(null);
    setError(null);
  };

  /** Load the full template — the table row carries only totals — then show its sheet. */
  const openPreview = (row: ESheetTemplateListItem): void => {
    clearMessages();
    setEditing(null);
    setSubmitError(undefined);
    void eSheetTemplateService
      .getTemplate(row.id)
      .then((template) => {
        if (!template) {
          setError('That template no longer exists.');
          return;
        }
        setPreview(template);
      })
      .catch(fail('Could not open that template'));
  };

  const openEdit = (row: ESheetTemplateListItem): void => {
    clearMessages();
    setPendingDelete(null);
    void eSheetTemplateService
      .getTemplate(row.id)
      .then((template) => {
        if (!template) {
          setError('That template no longer exists.');
          return;
        }
        setSubmitError(undefined);
        setPreview(template);
        setEditing({ id: template.id, value: toFormValue(template) });
      })
      .catch(fail('Could not open that template'));
  };

  const handleSave = (dto: CreateESheetTemplateDto): void => {
    if (!editing) return;
    setIsSubmitting(true);
    setSubmitError(undefined);
    void eSheetTemplateService
      .updateTemplate(editing.id, {
        name: dto.name,
        instructions: dto.instructions ?? '',
        questions: dto.questions,
      })
      .then(load)
      .then(() => {
        setIsSubmitting(false);
        setNotice(`"${dto.name}" updated.`);
        closeEditor();
      })
      .catch((cause: unknown) => {
        setIsSubmitting(false);
        setSubmitError(cause instanceof Error ? cause.message : 'Could not save the template');
      });
  };

  const handleToggle = (row: ESheetTemplateListItem): void => {
    clearMessages();
    void eSheetTemplateService
      .toggleTemplateActive(row.id)
      .then((updated) => {
        setNotice(`"${updated.name}" is now ${updated.isActive ? 'active' : 'inactive'}.`);
        return load();
      })
      .catch(fail('Could not change that template'));
  };

  const confirmDelete = (): void => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setPendingDelete(null);
    clearMessages();
    if (editing?.id === id) closeEditor();
    else if (preview?.id === id) setPreview(null);
    void eSheetTemplateService
      .deleteTemplate(id)
      .then(load)
      .then(() => setNotice(`"${name}" deleted.`))
      .catch(fail('Could not delete that template'));
  };

  const columns: ColumnDef<ESheetTemplateListItem>[] = [
    {
      key: 'name',
      header: 'Template',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: 'questions', header: 'Questions', render: (row) => row.questionCount, width: '110px' },
    { key: 'answers', header: 'Answers', render: (row) => row.answerCount, width: '100px' },
    { key: 'marks', header: 'Total Marks', render: (row) => row.totalMarks, width: '130px' },
    { key: 'pages', header: 'Pages', render: (row) => row.pageCount, width: '90px' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ActiveBadge active={row.isActive} />,
      width: '120px',
    },
    ...(canManageTemplates
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (row: ESheetTemplateListItem) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(row);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(row);
                  }}
                >
                  {row.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearMessages();
                    setPendingDelete(row);
                  }}
                >
                  Delete
                </Button>
              </div>
            ),
            width: '250px',
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="E-Sheet Templates"
        subtitle="Reusable question structures — pick one when generating e-sheets"
        actions={
          canManageTemplates && !editing ? (
            <Button variant="primary" onClick={() => void navigate(`${base}/add-template`)}>
              Add Template
            </Button>
          ) : undefined
        }
      />

      {notice && <Alert className="mb-6 print:hidden">{notice}</Alert>}
      {error && (
        <Alert tone="danger" className="mb-6 print:hidden">
          {error}
        </Alert>
      )}

      {pendingDelete && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 print:hidden">
          <p className="text-sm text-warning-foreground">
            Delete <span className="font-medium">{pendingDelete.name}</span> for good? Deactivate it
            instead to keep it for reference.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Side by side only from 2xl up — below that a split column squeezed every field row. */}
      {editing && (
        <div className="mb-6 grid gap-6 2xl:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6 print:hidden">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Edit Template</h2>
            <ESheetTemplateForm
              key={editing.id}
              mode="edit"
              initialValue={editing.value}
              isNameTaken={(name) => eSheetTemplateService.isTemplateNameTaken(name, editing.id)}
              onSave={handleSave}
              onCancel={closeEditor}
              onDraftChange={handleDraftChange}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between print:hidden">
              <h2 className="text-sm font-semibold text-foreground">Printed sheet preview</h2>
              {preview && (
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  Download PDF
                </Button>
              )}
            </div>
            <ESheetPreview template={preview} />
          </div>
        </div>
      )}

      {!editing && preview && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between print:hidden">
            <h2 className="text-sm font-semibold text-foreground">{preview.name}</h2>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                Download PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
          </div>
          <ESheetPreview template={preview} />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm print:hidden">
        <DataTable<ESheetTemplateListItem>
          data={templates}
          columns={columns}
          isLoading={isLoading}
          onRowClick={openPreview}
          emptyMessage="No templates yet"
        />
      </div>
    </>
  );
}

export default TemplatesListPage;
