/**
 * StudentDetailPage — three modes:
 * - Create  (`/manage`, no :id): the StudentForm, empty (with a gradient hero).
 * - Profile (`/:id`): a read-only StudentProfile (the default for an existing student).
 * - Edit    (`/:id` + "Edit Profile" clicked): the StudentForm pre-filled; Cancel/Save
 *   returns to Profile.
 *
 * Role-aware: ADMIN may pick any school; SCHOOL_STAFF is locked to their own
 * school. Shared by both roles, so navigation is derived from the current path.
 *
 * TODO: Replace mock data with API calls (students.findOne; results.findByStudent;
 * create / update on submit), and source schoolOptions from the schools query.
 */
import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { type Student, UserRole } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Check, ChevronLeft, UserPlus } from '@/design-system/atoms/icon';
import { type SelectOption } from '@/design-system/molecules/select-field';
import { StudentForm, type StudentFormPayload } from '@/design-system/organisms/student-form';
import { StudentProfile, type StudentResult } from '@/design-system/organisms/student-profile';
import { useAuth } from '@/hooks';

const MOCK_SCHOOL_OPTIONS: SelectOption[] = [
  { value: 'sch_001', label: 'Government High School Gulberg' },
  { value: 'sch_002', label: 'Government Boys Secondary School Clifton' },
  { value: 'sch_003', label: 'Federal Government School F-8' },
];

const MOCK_STUDENT: Student = {
  id: 'stu_001',
  studentRefId: 'ref-3f8a1c20',
  schoolId: 'sch_001',
  fullName: 'Ali Hassan',
  fatherOrGuardianName: 'Hassan Raza',
  gender: 'male',
  dateOfBirth: '2008-04-12',
  cnicOrBform: '35202-1234567-1',
  fatherOrGuardianCnic: '35202-7654321-9',
  fatherMobile: '03001234567',
  studentMobile: '03007654321',
  address: 'House 12, Street 5, Gulberg III',
  city: 'Lahore',
  district: 'Lahore',
  gradeId: 10,
  section: 'A',
  enrollmentStatus: 'active',
  createdAt: '2025-03-01T08:00:00.000Z',
};

// TODO: replace with useQuery(['student-results', id], () => resultsApi.findByStudent(id))
const MOCK_RESULTS: StudentResult[] = [
  {
    id: 'res_1',
    exam: 'SSC Part I — Annual 2024',
    obtainedMarks: 462,
    totalMarks: 550,
    grade: 'A',
    status: 'pass',
    declaredOn: '2024-08-20',
  },
  {
    id: 'res_2',
    exam: 'Grade 9 — Final Term 2023',
    obtainedMarks: 388,
    totalMarks: 500,
    grade: 'B',
    status: 'pass',
    declaredOn: '2023-06-15',
  },
  {
    id: 'res_3',
    exam: 'Grade 9 — Mid Term 2023',
    obtainedMarks: 410,
    totalMarks: 500,
    grade: 'A',
    status: 'pass',
    declaredOn: '2023-03-10',
  },
];

export function StudentDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();

  const isExisting = Boolean(id);
  const base = pathname.slice(0, pathname.indexOf('/students') + '/students'.length);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // School staff can only enrol into their own school; admins pick any.
  const isSchoolStaff = user?.role === UserRole.SCHOOL_STAFF;
  // Mock fallback — real SCHOOL_STAFF users carry their own schoolId.
  const schoolStaffSchoolId = user?.schoolId ?? 'sch_001';
  const schoolOptions = isSchoolStaff
    ? MOCK_SCHOOL_OPTIONS.filter((o) => o.value === schoolStaffSchoolId)
    : MOCK_SCHOOL_OPTIONS;

  // TODO: in profile/edit mode, replace with useQuery(['student', id], () => studentsApi.findOne(id))
  const student = isExisting ? MOCK_STUDENT : null;
  const schoolName = student
    ? (MOCK_SCHOOL_OPTIONS.find((o) => o.value === student.schoolId)?.label ?? student.schoolId)
    : undefined;

  // Show the form when creating, or when editing an existing student.
  const showForm = !isExisting || isEditing;

  const initialValues: Partial<StudentFormPayload> | undefined =
    isExisting && student
      ? {
          schoolId: student.schoolId,
          fullName: student.fullName,
          fatherOrGuardianName: student.fatherOrGuardianName,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          photoUrl: student.photoUrl,
          cnicOrBform: student.cnicOrBform,
          fatherOrGuardianCnic: student.fatherOrGuardianCnic,
          fatherMobile: student.fatherMobile,
          studentMobile: student.studentMobile,
          address: student.address,
          city: student.city,
          district: student.district,
          postalAddress: student.postalAddress,
          gradeId: student.gradeId,
          enrollmentStatus: student.enrollmentStatus,
        }
      : isSchoolStaff
        ? { schoolId: schoolStaffSchoolId }
        : undefined;

  const handleSubmit = (payload: StudentFormPayload): void => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    // TODO: replace with API call — studentsApi.update(id, payload) or studentsApi.create(payload)
    setTimeout(() => {
      if (isExisting) {
        console.log('Update student:', id, payload);
        setSuccessMessage('Student updated successfully');
        setIsEditing(false); // back to the profile view
      } else {
        console.log('Create student:', payload);
        setSuccessMessage('Student enrolled successfully');
      }
      setIsSubmitting(false);
    }, 1000);
  };

  const initials = (student?.fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const statusLabel = student
    ? student.enrollmentStatus.charAt(0).toUpperCase() + student.enrollmentStatus.slice(1)
    : '';

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate(`${base}/view`)}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to Students
      </Button>

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

      {showForm ? (
        <>
          {/* Gradient hero — identity (edit) or create prompt */}
          <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-4 bg-brand-gradient px-6 py-6 text-white">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-xl font-semibold ring-2 ring-white/25">
                {isExisting && student?.photoUrl ? (
                  <img src={student.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : isExisting && initials ? (
                  initials
                ) : (
                  <UserPlus className="h-7 w-7" aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-semibold">
                  {isExisting ? (student?.fullName ?? 'Student') : 'Add Student'}
                </h1>
                <p className="mt-1 text-sm text-white/80">
                  {isExisting && student
                    ? `Ref ${student.studentRefId} · Grade ${student.gradeId}`
                    : 'Enrol a new student into the system'}
                </p>
              </div>

              {isExisting && student && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25">
                  {statusLabel}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
            <StudentForm
              mode={isExisting ? 'edit' : 'create'}
              schoolOptions={schoolOptions}
              lockSchool={isSchoolStaff}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              onCancel={
                isExisting ? () => setIsEditing(false) : () => void navigate(`${base}/view`)
              }
            />
          </div>
        </>
      ) : (
        student && (
          <StudentProfile
            student={student}
            schoolName={schoolName}
            results={MOCK_RESULTS}
            onEdit={() => {
              setIsEditing(true);
              setSuccessMessage(null);
            }}
          />
        )
      )}
    </>
  );
}

export default StudentDetailPage;
