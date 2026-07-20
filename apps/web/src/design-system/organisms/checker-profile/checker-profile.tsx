/**
 * CheckerProfile (organism) — the read-only view of one checker.
 *
 * Rendered by the single checker detail page, which is reached from BOTH the checkers
 * list and the approvals queue — so an approver and an institute see exactly the same
 * record, and there is one place to change what a checker looks like.
 *
 * Presentational: the page resolves ids to labels and passes them in. Identity documents
 * are withheld unless `canViewPII`, defaulting to withheld so a new caller fails safe.
 */
import React from 'react';

import { type Checker } from '@oses/types';

import { Badge, type BadgeProps } from '@/design-system/atoms/badge';
import {
  Building2,
  FileText,
  GraduationCap,
  type LucideIcon,
  MapPin,
  User,
} from '@/design-system/atoms/icon';

const STATUS_VARIANT: Record<Checker['status'], BadgeProps['variant']> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

const STATUS_LABEL: Record<Checker['status'], string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

const DOCUMENT_LABEL: Record<Checker['documents'][number]['kind'], string> = {
  qualification: 'Qualification certificate',
  cnic: 'CNIC copy',
  nomination: 'Nomination letter',
};

/** Placeholder shown in place of a withheld PII value. */
const REDACTED = '••••••';

export interface CheckerProfileProps {
  checker: Checker;
  /** Resolved institute name; only meaningful for a school-specific checker. */
  instituteLabel?: string;
  /** Resolved subject names for `checker.subjectIds`. */
  subjectLabels: string[];
  /** Resolved class names for `checker.levelIds`. */
  levelLabels: string[];
  /** Whether the viewer may see identity documents (CNIC, date of birth). */
  canViewPII?: boolean;
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

const grid = 'grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4';

function list(values: string[]): string {
  return values.length > 0 ? values.join(', ') : '—';
}

export function CheckerProfile({
  checker,
  instituteLabel,
  subjectLabels,
  levelLabels,
  canViewPII = false,
}: CheckerProfileProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-brand-gradient px-6 py-5 text-white">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{checker.fullName}</h1>
            <p className="mt-0.5 font-mono text-xs text-white/80">{checker.checkerRefId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25">
              {checker.checkerType === 'general'
                ? 'General'
                : (instituteLabel ?? 'School-specific')}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25">
              Added by {checker.addedBy === 'institute' ? 'institute' : 'super admin'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <Badge variant={STATUS_VARIANT[checker.status]}>{STATUS_LABEL[checker.status]}</Badge>
          {checker.status === 'approved' && checker.userId && (
            <span className="text-xs text-muted-foreground">
              Evaluator login active for {checker.email}
            </span>
          )}
          {checker.status === 'rejected' && checker.rejectionReason && (
            <span className="text-xs text-danger-foreground">
              Reason: {checker.rejectionReason}
            </span>
          )}
        </div>
      </div>

      <Card icon={GraduationCap} title="Professional & Qualification">
        <dl className={grid}>
          <Field label="Highest qualification" value={checker.highestQualification} />
          <Field label="Specialization" value={checker.specialization} />
          <Field label="Designation" value={checker.designation ?? '—'} />
          <Field label="Current employer" value={checker.currentEmployer ?? '—'} />
          <Field
            label="Teaching experience"
            value={`${checker.yearsTeachingExperience} year${checker.yearsTeachingExperience === 1 ? '' : 's'}`}
          />
          <Field
            label="Marking experience"
            value={`${checker.yearsMarkingExperience} year${checker.yearsMarkingExperience === 1 ? '' : 's'}`}
          />
        </dl>
      </Card>

      <Card icon={FileText} title="Marking Scope">
        <dl className={grid}>
          <Field label="Subjects" value={list(subjectLabels)} />
          <Field label="Classes" value={list(levelLabels)} />
          <Field
            label="Daily capacity"
            value={checker.dailyCapacity ? `${checker.dailyCapacity} scripts` : '—'}
          />
        </dl>
      </Card>

      <Card icon={FileText} title="Supporting Documents">
        {checker.documents.length === 0 ? (
          <p className="text-sm text-danger-foreground">No documents attached.</p>
        ) : (
          <ul className="space-y-2">
            {checker.documents.map((doc) => (
              <li key={doc.kind} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{DOCUMENT_LABEL[doc.kind]}</span>
                <span className="font-mono text-xs text-foreground">{doc.fileName}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card icon={User} title="Personal">
        <dl className={grid}>
          <Field label="Father / Guardian" value={checker.fatherOrGuardianName} />
          <Field label="Gender" value={checker.gender} />
          <Field label="Date of birth" value={canViewPII ? checker.dateOfBirth : REDACTED} />
          <Field label="CNIC" value={canViewPII ? checker.cnic : REDACTED} />
        </dl>
      </Card>

      <Card icon={MapPin} title="Contact">
        <dl className={grid}>
          <Field label="Email" value={checker.email} />
          <Field label="Mobile" value={checker.mobile} />
          <Field label="Alternate phone" value={checker.alternatePhone ?? '—'} />
          <Field label="City" value={checker.city} />
          <Field label="District" value={checker.district ?? '—'} />
          <Field label="Province" value={checker.province} />
          <Field label="Address" value={checker.address} />
        </dl>
      </Card>

      {checker.checkerType === 'school-specific' && (
        <Card icon={Building2} title="Institute Binding">
          <p className="text-sm text-muted-foreground">
            This checker may only mark papers for{' '}
            <span className="font-medium text-foreground">
              {instituteLabel ?? checker.instituteId}
            </span>
            .
          </p>
        </Card>
      )}
    </div>
  );
}

export default CheckerProfile;
