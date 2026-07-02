/**
 * PapersEditor (organism) — the dynamic list of subject papers under an exam.
 *
 * A controlled component: the parent (ExamForm) owns the `papers` array and gets
 * a new array on every edit. Each paper is compulsory (every candidate sits it) or
 * elective (candidates may choose any number). Kept separate from the Formik-driven
 * scalar fields because a variable-length list of rows doesn't map cleanly onto a
 * flat Formik schema; the parent validates it on submit.
 */
import React from 'react';

import type { ExamPaperType } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { FileText, Plus, X } from '@/design-system/atoms/icon';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

/** Draft shape used by the form controls (all strings; parsed to the DTO on submit). */
export interface PaperDraft {
  subject: string;
  totalMarks: string;
  paperDate: string;
  paperType: ExamPaperType;
}

export function emptyPaper(): PaperDraft {
  return { subject: '', totalMarks: '', paperDate: '', paperType: 'compulsory' };
}

const PAPER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'compulsory', label: 'Compulsory' },
  { value: 'elective', label: 'Elective' },
];

export interface PapersEditorProps {
  papers: PaperDraft[];
  onChange: (papers: PaperDraft[]) => void;
  /** Editor-level error (e.g. "Add at least one paper"). */
  error?: string;
}

export function PapersEditor({ papers, onChange, error }: PapersEditorProps): React.ReactElement {
  const update = (index: number, patch: Partial<PaperDraft>): void => {
    onChange(papers.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const remove = (index: number): void => {
    onChange(papers.filter((_, i) => i !== index));
  };

  const add = (): void => {
    onChange([...papers, emptyPaper()]);
  };

  return (
    <div className="space-y-4">
      {papers.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No papers yet. Add the subjects candidates will sit for this exam.
        </p>
      )}

      {papers.map((paper, index) => (
        // eslint-disable-next-line react/no-array-index-key -- draft rows have no stable id
        <div key={index} className="relative rounded-xl border border-border bg-muted/30 p-4 pr-11">
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label={`Remove paper ${index + 1}`}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger-subtle hover:text-danger-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>

          <div className="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2 lg:grid-cols-4">
            <FormField
              id={`paper-${index}-subject`}
              label="Subject"
              value={paper.subject}
              onChange={(e) => update(index, { subject: e.target.value })}
            />
            <SelectField
              id={`paper-${index}-type`}
              label="Type"
              options={PAPER_TYPE_OPTIONS}
              value={paper.paperType}
              onChange={(value) => update(index, { paperType: value as ExamPaperType })}
            />
            <FormField
              id={`paper-${index}-marks`}
              label="Total Marks"
              inputMode="numeric"
              value={paper.totalMarks}
              onChange={(e) => update(index, { totalMarks: e.target.value })}
            />
            <FormField
              id={`paper-${index}-date`}
              label="Paper Date"
              type="date"
              value={paper.paperDate}
              onChange={(e) => update(index, { paperDate: e.target.value })}
            />
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-danger-foreground">{error}</p>}

      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus className="h-4 w-4" aria-hidden />
        Add Paper
      </Button>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" aria-hidden />
        Compulsory papers are sat by everyone. Candidates may choose any of the elective papers.
      </p>
    </div>
  );
}

export default PapersEditor;
