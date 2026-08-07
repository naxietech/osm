import React from 'react';

import type { InstituteCategory, InstituteDetail } from '@oses/types';

import { Badge } from '@/design-system/atoms/badge';
import {
  Building2,
  ClipboardList,
  type LucideIcon,
  MapPin,
  User,
} from '@/design-system/atoms/icon';

export interface InstituteSummaryProps {
  institute: InstituteDetail;
  /**
   * Used to name the institute's category and to label its answers. Omit it — while the list is
   * still loading, or for a caller that has none — and the category shows as its raw id rather
   * than a blank, and the answers are withheld entirely rather than shown as bare values with no
   * question attached.
   */
  categories?: InstituteCategory[];
}

const NOT_GIVEN = '—';

/** Reads an enum-ish stored value as words: `semi_government` → `Semi government`. */
function humanise(value: string): string {
  const spaced = value.replace(/[_-]/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * An institute as a record to read, not a form to edit.
 *
 * The detail screen used to render the editable form even when all anyone wanted was to look —
 * which meant a reviewer deciding whether to approve an application was reading it out of input
 * boxes, with a Save button in reach of a decision that has nothing to do with saving. Editing
 * now has its own screen; this one only shows.
 *
 * Presentational: it takes the record and renders it. Status, approval, deactivation and every
 * other decision belong to the page, which is where the confirmations and the service calls are.
 */
export function InstituteSummary({
  institute,
  categories,
}: InstituteSummaryProps): React.ReactElement {
  const category = categories?.find((c) => c.id === institute.categoryId);

  /**
   * Answers are matched back to their questions by id. An answer whose question is not in the
   * category — a question retired since the institute registered — is dropped rather than shown
   * as a value with nothing to explain it.
   */
  const answers = (category?.questions ?? [])
    .map((q) => ({ question: q, answer: institute.answers.find((a) => a.questionId === q.id) }))
    .filter((pair) => pair.answer !== undefined && pair.answer.values.length > 0);

  return (
    <div className="space-y-8">
      <Section icon={Building2} title="Institute">
        <Field label="Institute name" value={institute.instituteName} />
        <Field label="Branch / campus" value={institute.branch} />
        <Field label="Institute code" value={institute.instituteCode} mono />
        <Field
          label="Institute number"
          value={
            institute.numericCode === null ? null : String(institute.numericCode).padStart(4, '0')
          }
          mono
          // Drawn at approval and never reissued, so its absence is meaningful: this
          // application has not been approved yet.
          hint={institute.numericCode === null ? 'Drawn when the institute is approved' : undefined}
        />
        <Field label="Category" value={category?.name ?? institute.categoryId} />
        <Field label="Institution type" value={humanise(institute.institutionType)} />
      </Section>

      <Section icon={MapPin} title="Address">
        <Field label="Address" value={institute.address} className="sm:col-span-2 lg:col-span-3" />
        <Field label="City" value={institute.city} />
        <Field label="Province / region" value={institute.province.toUpperCase()} />
        <Field label="Postal code" value={institute.postalCode} />
      </Section>

      <Section icon={User} title="Contact person">
        <Field label="Name" value={institute.contactPersonName} />
        <Field label="Designation" value={institute.contactPersonDesignation} />
        <Field label="Email" value={institute.contactEmail} />
        <Field label="Phone" value={institute.contactPhone} />
      </Section>

      {answers.length > 0 && (
        <Section icon={ClipboardList} title={`${category?.name ?? 'Category'} questions`} single>
          {answers.map(({ question, answer }) => (
            <div key={question.id}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {question.text}
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {answer?.values.map((value) => (
                  <Badge key={value} variant="info">
                    {value}
                  </Badge>
                ))}
              </dd>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  single = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** One column — for long-form content like question answers. */
  single?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      </div>
      <dl
        className={
          single ? 'space-y-4' : 'grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3'
        }
      >
        {children}
      </dl>
    </section>
  );
}

function Field({
  label,
  value,
  mono = false,
  hint,
  className,
}: {
  label: string;
  /** `null`/empty renders as a dash — an empty gap reads as a rendering fault, not as "none". */
  value: string | null | undefined;
  mono?: boolean;
  hint?: string;
  className?: string;
}): React.ReactElement {
  const empty = value === null || value === undefined || value.trim() === '';
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={[
          'mt-1 text-sm',
          empty ? 'text-muted-foreground' : 'text-foreground',
          mono && !empty ? 'font-mono' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {empty ? NOT_GIVEN : value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default InstituteSummary;
