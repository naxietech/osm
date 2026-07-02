/**
 * ExamRegisterPage (SCHOOL_STAFF) — register a class of students for one exam.
 *
 * Two parts: the school's already-registered candidates (read-only, with roll number /
 * status once assigned) and the register form — the school's eligible students (own
 * school, matching grade, active, not yet registered) in the CandidatePicker. Staff
 * tick students, optionally pick elective papers, and submit them all in one call. The
 * school comes from the signed-in user (SafeUser.schoolId).
 *
 * TODO: Replace service calls with React Query.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  type CandidateListItem,
  type CreateExamRegistrationDto,
  type Exam,
  ExamStatus,
  type RegistrationStatus,
} from '@oses/types';

import { Badge, type BadgeProps } from '@/design-system/atoms/badge';
import { Button } from '@/design-system/atoms/button';
import { Check, ChevronLeft } from '@/design-system/atoms/icon';
import { Spinner } from '@/design-system/atoms/spinner';
import { type SelectOption } from '@/design-system/molecules/select-field';
import {
  CandidatePicker,
  type CandidateSelectionMap,
} from '@/design-system/organisms/candidate-picker';
import { useAuth } from '@/hooks';
import { examRegistrationService } from '@/services/exam-registration.service';
import { examService } from '@/services/exam.service';
import type { StoredStudent } from '@/services/mock-store';

const STATUS_BADGE: Record<RegistrationStatus, { label: string; variant: BadgeProps['variant'] }> =
  {
    pending: { label: 'Pending', variant: 'warning' },
    confirmed: { label: 'Confirmed', variant: 'success' },
    withdrawn: { label: 'Withdrawn', variant: 'default' },
  };

export function ExamRegisterPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const schoolId = user?.schoolId ?? '';
  const base = pathname.slice(0, pathname.indexOf('/exams') + '/exams'.length);

  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<StoredStudent[]>([]);
  const [registered, setRegistered] = useState<CandidateListItem[]>([]);
  const [selection, setSelection] = useState<CandidateSelectionMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!id || !schoolId) {
      setIsLoading(false);
      return;
    }
    const [examData, studentData, registeredData] = await Promise.all([
      examService.getExam(id),
      examRegistrationService.listRegisterableStudents(id, schoolId),
      examRegistrationService.listCandidatesForSchool(id, schoolId),
    ]);
    setExam(examData ?? null);
    setStudents(studentData);
    setRegistered(registeredData);
    setIsLoading(false);
  }, [id, schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const electives = useMemo<SelectOption[]>(
    () =>
      exam
        ? exam.papers
            .filter((p) => p.paperType === 'elective')
            .map((p) => ({ value: p.id, label: p.subject }))
        : [],
    [exam],
  );
  const compulsoryPapers = exam ? exam.papers.filter((p) => p.paperType === 'compulsory') : [];
  const selectedCount = Object.keys(selection).length;
  const canRegister = exam?.status === ExamStatus.REGISTRATION_OPEN;

  const handleSubmit = (): void => {
    if (!id) return;
    setError(null);

    const refs = Object.keys(selection);
    if (refs.length === 0) {
      setError('Select at least one student.');
      return;
    }

    setIsSubmitting(true);
    const dto: CreateExamRegistrationDto = {
      examId: id,
      candidates: refs.map((studentRefId) => ({
        studentRefId,
        electivePaperIds: selection[studentRefId] ?? [],
      })),
    };

    void examRegistrationService.registerStudents(dto).then((created) => {
      setSuccessMessage(
        `Registered ${created.length} student${created.length === 1 ? '' : 's'} for ${exam?.name ?? 'the exam'}.`,
      );
      setSelection({});
      setIsSubmitting(false);
      void load(); // refresh eligible + registered lists
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate(base)}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to Exams
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground">
          {exam ? `Register — ${exam.name}` : 'Register Students'}
        </h1>
        {exam && (
          <p className="mt-1 text-sm text-muted-foreground">
            {exam.code} · {exam.session} · Grade {exam.gradeId}
          </p>
        )}
      </div>

      {successMessage && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-sm font-medium text-success-foreground"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : !schoolId ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          Your account isn&apos;t linked to a school, so you can&apos;t register candidates.
        </div>
      ) : !exam ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          Exam not found.
        </div>
      ) : (
        <>
          {/* Papers summary */}
          <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Papers</h2>
            <div className="flex flex-wrap gap-2">
              {compulsoryPapers.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-medium text-brand"
                >
                  {p.subject}
                </span>
              ))}
              {electives.map((e) => (
                <span
                  key={e.value}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {e.label} <span className="opacity-70">(elective)</span>
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Compulsory papers apply to every candidate. Electives are optional — pick any that
              apply.
            </p>
          </div>

          {/* Your registered candidates */}
          <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                Your registered candidates ({registered.length})
              </h2>
            </div>
            {registered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                You haven&apos;t registered any students for this exam yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {registered.map((c) => {
                  const badge = STATUS_BADGE[c.status];
                  return (
                    <li
                      key={c.registrationId}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                    >
                      <span className="min-w-[9rem] flex-1 font-medium text-foreground">
                        {c.fullName ?? c.studentRefId}
                      </span>
                      <span className="flex-1 text-xs text-muted-foreground">
                        {c.electiveSubjects.length > 0
                          ? c.electiveSubjects.join(', ')
                          : 'No electives'}
                      </span>
                      {c.rollNumber && (
                        <span className="font-mono text-xs text-foreground">{c.rollNumber}</span>
                      )}
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Register more students — only while the window is open */}
          {canRegister ? (
            <>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Register students</h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <CandidatePicker
                  students={students}
                  electives={electives}
                  value={selection}
                  onChange={setSelection}
                />
              </div>

              {error && <p className="mt-4 text-sm text-danger-foreground">{error}</p>}

              <div className="mt-6 flex items-center gap-4">
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={selectedCount === 0}
                >
                  Register {selectedCount > 0 ? `${selectedCount} ` : ''}
                  {selectedCount === 1 ? 'Student' : 'Students'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedCount} selected of {students.length} eligible
                </span>
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
              Registration for this exam is closed. You can view your registered candidates above.
            </p>
          )}
        </>
      )}
    </>
  );
}

export default ExamRegisterPage;
