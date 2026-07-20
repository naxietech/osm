/**
 * ExamDetailPage (ADMIN) — doubles as create (no :id) and edit (with :id), driven by
 * the ExamForm organism, mirroring InstituteDetailPage. In edit mode it also exposes the
 * board lifecycle actions: open registration, then close it and assign roll numbers.
 *
 * TODO: Replace examService calls with React Query mutations.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { type CreateExamDto, type Exam, ExamStatus } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { ChevronLeft, GraduationCap, Users } from '@/design-system/atoms/icon';
import { Spinner } from '@/design-system/atoms/spinner';
import { Alert } from '@/design-system/molecules/alert';
import { ExamForm } from '@/design-system/organisms/exam-form';
import {
  classGroupOptionsByLevelMap,
  levelSelectOptions,
  subgroupOptionsByLevelGroupMap,
  subjects,
} from '@/services/academic.service';
import { examService } from '@/services/exam.service';
import { INSTITUTE_OPTIONS } from '@/services/users.service';

import { ExamStatusBadge } from './exam-status-badge';

const LEVEL_OPTIONS = levelSelectOptions();
const GROUP_OPTIONS_BY_LEVEL = classGroupOptionsByLevelMap();
const SUBGROUP_OPTIONS_BY_LEVEL_GROUP = subgroupOptionsByLevelGroupMap();
const SUBJECT_OPTIONS = subjects
  .filter((s) => s.isActive)
  .map((s) => ({ value: s.id, label: s.name }));

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
                ? `${exam.code} · ${exam.session} · Class ${exam.classNumber}`
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

      {successMessage && <Alert className="mb-6">{successMessage}</Alert>}

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
              levelOptions={LEVEL_OPTIONS}
              groupOptionsByLevel={GROUP_OPTIONS_BY_LEVEL}
              subgroupOptionsByLevelGroup={SUBGROUP_OPTIONS_BY_LEVEL_GROUP}
              subjectOptions={SUBJECT_OPTIONS}
              instituteOptions={INSTITUTE_OPTIONS}
              lockInstituteScope={Boolean(exam && exam.status !== ExamStatus.DRAFT)}
              initialValues={
                isEdit && exam
                  ? {
                      code: exam.code,
                      name: exam.name,
                      session: exam.session,
                      levelId: exam.levelId,
                      groupId: exam.groupId,
                      instituteScope: exam.instituteScope,
                      registrationOpensAt: exam.registrationOpensAt,
                      registrationClosesAt: exam.registrationClosesAt,
                      papers: exam.papers,
                      ...(exam.subgroupId ? { subgroupId: exam.subgroupId } : {}),
                      ...(exam.subjectIds ? { subjectIds: exam.subjectIds } : {}),
                      ...(exam.shift ? { shift: exam.shift } : {}),
                      ...(exam.examCompletedDate
                        ? { examCompletedDate: exam.examCompletedDate }
                        : {}),
                      ...(exam.instituteIds ? { instituteIds: exam.instituteIds } : {}),
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
