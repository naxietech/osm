/**
 * ExamDetailPage (ADMIN) — doubles as create (no :id) and edit (with :id), driven by
 * the ExamForm organism, mirroring SchoolDetailPage. In edit mode it also exposes the
 * board lifecycle actions: open registration, then close it and assign roll numbers.
 *
 * TODO: Replace examService calls with React Query mutations.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { type CreateExamDto, type Exam, ExamStatus } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Check, ChevronLeft, GraduationCap, Users } from '@/design-system/atoms/icon';
import { Spinner } from '@/design-system/atoms/spinner';
import { ExamForm } from '@/design-system/organisms/exam-form';
import { examService } from '@/services/exam.service';

import { ExamStatusBadge } from './exam-status-badge';

export function ExamDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = pathname.slice(0, pathname.indexOf('/exams') + '/exams'.length);
  const isEdit = Boolean(id);

  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !id) return;
    let active = true;
    void examService.getExam(id).then((data) => {
      if (active) {
        setExam(data ?? null);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id, isEdit]);

  const handleSubmit = (dto: CreateExamDto): void => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    if (isEdit && id) {
      void examService.updateExam(id, dto).then((updated) => {
        setExam(updated);
        setSuccessMessage('Exam updated successfully');
        setIsSubmitting(false);
      });
    } else {
      void examService.createExam(dto).then((created) => {
        setIsSubmitting(false);
        void navigate(`${base}/${created.id}`);
      });
    }
  };

  const openRegistration = (): void => {
    if (!id) return;
    setStatusBusy(true);
    setSuccessMessage(null);
    void examService.setStatus(id, ExamStatus.REGISTRATION_OPEN).then((updated) => {
      setExam(updated);
      setSuccessMessage('Registration is now open — schools can register candidates.');
      setStatusBusy(false);
    });
  };

  const closeAndAssign = (): void => {
    if (!id) return;
    setStatusBusy(true);
    setSuccessMessage(null);
    void examService.assignRollNumbers(id).then((updated) => {
      setExam(updated);
      setSuccessMessage('Registration closed and roll numbers assigned.');
      setStatusBusy(false);
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

      {/* Gradient hero */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-4 bg-brand-gradient px-6 py-6 text-white">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/25">
            <GraduationCap className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold">
              {isEdit ? (exam?.name ?? 'Exam') : 'Create Exam'}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {isEdit && exam
                ? `${exam.code} · ${exam.session} · Grade ${exam.gradeId}`
                : 'Set up a new exam session and its papers'}
            </p>
          </div>
          {isEdit && exam && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
              <ExamStatusBadge status={exam.status} />
            </span>
          )}
        </div>
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
      ) : isEdit && !exam ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          Exam not found.
        </div>
      ) : (
        <>
          {/* Lifecycle actions (edit only) */}
          {isEdit && exam && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void navigate(`${base}/${exam.id}/candidates`)}
              >
                <Users className="h-4 w-4" aria-hidden />
                View Candidates
              </Button>
              {exam.status === ExamStatus.DRAFT && (
                <Button size="sm" onClick={openRegistration} isLoading={statusBusy}>
                  Open Registration
                </Button>
              )}
              {exam.status === ExamStatus.REGISTRATION_OPEN && (
                <Button size="sm" onClick={closeAndAssign} isLoading={statusBusy}>
                  Close &amp; Assign Roll Numbers
                </Button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
            <ExamForm
              mode={isEdit ? 'edit' : 'create'}
              initialValues={
                isEdit && exam
                  ? {
                      code: exam.code,
                      name: exam.name,
                      session: exam.session,
                      schoolLevel: exam.schoolLevel,
                      gradeId: exam.gradeId,
                      registrationOpensAt: exam.registrationOpensAt,
                      registrationClosesAt: exam.registrationClosesAt,
                      papers: exam.papers,
                    }
                  : undefined
              }
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              onCancel={() => void navigate(base)}
            />
          </div>
        </>
      )}
    </>
  );
}

export default ExamDetailPage;
