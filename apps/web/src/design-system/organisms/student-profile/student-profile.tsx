/**
 * StudentProfile (organism) — read-only profile view of a Student.
 * Two-column layout: a sticky summary card (identity, quick facts, contact, Edit)
 * beside stacked content cards (performance + trend, results, details, address).
 * Used by the detail page's "view" mode; clicking Edit swaps in StudentForm.
 *
 * Shows PII (names, CNICs, mobiles, address) — only ADMIN / CONTROLLER / school
 * staff reach this page; evaluators never do.
 */
import React from 'react';

import { type Student } from '@oses/types';

import { Badge } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import {
  Award,
  BarChart3,
  type LucideIcon,
  MapPin,
  Pencil,
  Phone,
  User,
} from '@/design-system/atoms/icon';
import { TrendAreaChart, type TrendPoint } from '@/design-system/organisms/charts';

/** A past exam result row. (Presentational contract — moves to @oses/types with the results module.) */
export interface StudentResult {
  id: string;
  /** Exam / session name, e.g. "SSC Part I — Annual 2024". */
  exam: string;
  obtainedMarks: number;
  totalMarks: number;
  grade: string;
  status: 'pass' | 'fail';
  /** ISO date the result was declared. */
  declaredOn?: string;
}

export interface StudentProfileProps {
  student: Student;
  /** Resolved school name; falls back to the school id. */
  schoolName?: string;
  /** Past exam results, most recent first. */
  results?: StudentResult[];
  /** When provided, renders an Edit button in the summary card. */
  onEdit?: () => void;
}

const capitalize = (value?: string): string =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

const percentage = (obtained: number, total: number): number =>
  total > 0 ? Math.round((obtained / total) * 100) : 0;

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function shortDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Iconed card heading. */
function CardHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{children}</h3>
    </div>
  );
}

/** Read-only label / value pair (content cards). */
function Field({ label, value }: { label: string; value?: React.ReactNode }): React.ReactElement {
  const isEmpty = value === undefined || value === null || value === '';
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{isEmpty ? '—' : value}</dd>
    </div>
  );
}

/** Compact label / value row (summary sidebar). */
function SummaryRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: LucideIcon;
}): React.ReactElement {
  const isEmpty = value === undefined || value === null || value === '';
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </dt>
      <dd className="truncate text-right text-sm font-medium text-foreground">
        {isEmpty ? '—' : value}
      </dd>
    </div>
  );
}

/** Performance KPI tile. */
function MiniStat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function StudentProfile({
  student,
  schoolName,
  results = [],
  onEdit,
}: StudentProfileProps): React.ReactElement {
  const detailGrid = 'grid grid-cols-2 gap-x-6 gap-y-5 xl:grid-cols-4';

  const pcts = results.map((result) => percentage(result.obtainedMarks, result.totalMarks));
  const latestPct = pcts[0] ?? 0;
  const highestPct = pcts.length ? Math.max(...pcts) : 0;
  const averagePct = pcts.length
    ? Math.round(pcts.reduce((sum, value) => sum + value, 0) / pcts.length)
    : 0;
  const hasResults = results.length > 0;

  // Oldest → newest so the trend reads left-to-right over time.
  const trendData: TrendPoint[] = results
    .map((result) => ({
      label: shortDate(result.declaredOn),
      value: percentage(result.obtainedMarks, result.totalMarks),
    }))
    .reverse();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Summary sidebar */}
      <aside className="lg:sticky lg:top-6 lg:col-span-1 lg:self-start">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col items-center gap-3 bg-brand-gradient px-6 py-7 text-center text-white">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/15 text-2xl font-semibold ring-2 ring-white/25">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(student.fullName)
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{student.fullName}</h2>
              <p className="truncate text-sm text-white/80">s/o {student.fatherOrGuardianName}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
                {capitalize(student.enrollmentStatus)}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
                Grade {student.gradeId}
                {student.section ? ` · ${student.section}` : ''}
              </span>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quick Facts
              </p>
              <dl className="mt-3 space-y-2.5">
                <SummaryRow label="Reference ID" value={student.studentRefId} />
                <SummaryRow label="School" value={schoolName ?? student.schoolId} />
                <SummaryRow label="Enrolled On" value={formatDate(student.createdAt)} />
              </dl>
            </div>

            <div className="border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </p>
              <dl className="mt-3 space-y-2.5">
                <SummaryRow icon={Phone} label="Father" value={student.fatherMobile} />
                <SummaryRow icon={Phone} label="Student" value={student.studentMobile} />
              </dl>
            </div>

            {onEdit && (
              <Button onClick={onEdit} className="w-full">
                <Pencil className="h-4 w-4" aria-hidden />
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Content cards */}
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <CardHeading icon={BarChart3}>Performance</CardHeading>
          {hasResults ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MiniStat label="Latest" value={`${latestPct}%`} />
                <MiniStat label="Highest" value={`${highestPct}%`} />
                <MiniStat label="Average" value={`${averagePct}%`} />
                <MiniStat label="Exams Taken" value={String(results.length)} />
              </div>
              {results.length > 1 && (
                <div className="mt-6">
                  <TrendAreaChart data={trendData} height={200} valueFormatter={(v) => `${v}%`} />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No results recorded yet.</p>
          )}
        </div>

        {hasResults && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <CardHeading icon={Award}>Results</CardHeading>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-4">Exam</th>
                    <th className="pb-2 pr-4">Marks</th>
                    <th className="pb-2 pr-4">Percentage</th>
                    <th className="pb-2 pr-4">Grade</th>
                    <th className="pb-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-foreground">{result.exam}</p>
                        {result.declaredOn && (
                          <p className="text-xs text-muted-foreground">
                            Declared {formatDate(result.declaredOn)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-foreground">
                        {result.obtainedMarks} / {result.totalMarks}
                      </td>
                      <td className="py-3 pr-4 font-medium tabular-nums text-foreground">
                        {percentage(result.obtainedMarks, result.totalMarks)}%
                      </td>
                      <td className="py-3 pr-4 font-semibold text-foreground">{result.grade}</td>
                      <td className="py-3">
                        <Badge variant={result.status === 'pass' ? 'success' : 'error'}>
                          {capitalize(result.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <CardHeading icon={User}>Details</CardHeading>
          <dl className={detailGrid}>
            <Field label="Gender" value={capitalize(student.gender)} />
            <Field label="Date of Birth" value={formatDate(student.dateOfBirth)} />
            <Field label="Student CNIC / B-Form" value={student.cnicOrBform} />
            <Field label="Father / Guardian CNIC" value={student.fatherOrGuardianCnic} />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <CardHeading icon={MapPin}>Address</CardHeading>
          <dl className={detailGrid}>
            <Field label="Address" value={student.address} />
            <Field label="City" value={student.city} />
            <Field label="District" value={student.district} />
            <Field label="Postal Address" value={student.postalAddress} />
          </dl>
        </div>
      </div>
    </div>
  );
}

export default StudentProfile;
