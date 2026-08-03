/**
 * Academic structure — the configurable model that lets one system serve schools,
 * colleges and universities:
 *
 *   Institution (kind) → Level → Group/Program → Subject/Course
 *   Curriculum maps which subjects a Level + Group sits (compulsory/elective).
 *
 * Levels, groups, subjects and curriculum are Admin-managed reference data (seeded as
 * mock for now). Students and exams reference a Level + Group; exam papers are drawn
 * from the curriculum. `creditHours` is reserved for the later university/GPA phase.
 */

/** The kind of institution — drives labels and which academic structure applies. */
export enum InstitutionKind {
  SCHOOL = 'school',
  COLLEGE = 'college',
  UNIVERSITY = 'university',
}

/**
 * A subgroup — the third level of the class hierarchy (Class → Group → Subgroup),
 * e.g. Class 9 → Science → **Biology**. Defined inline under a class's group.
 */
export interface Subgroup {
  id: string;
  name: string; // 'Biology'
  code?: string;
  isActive: boolean;
}

/**
 * A group within a class, carrying its own subgroups (the inline Class → Group →
 * Subgroup structure the super admin authors on the Class screen). Its `id` may reuse
 * a global {@link Group} id so downstream references stay compatible.
 */
export interface ClassGroup {
  id: string;
  name: string; // 'Science'
  code?: string;
  isActive: boolean;
  subgroups: Subgroup[];
}

/** A configurable level: Class 1–12 (school), 1st/2nd Year (college), Semester (university). */
export interface Level {
  id: string;
  kind: InstitutionKind;
  name: string; // 'Class 9', '1st Year', 'Semester 1'
  ordinal: number; // progression / sort order
  description?: string;
  /** Inline Class → Group → Subgroup structure (TRD). Source of truth for a class's groups. */
  classGroups?: ClassGroup[];
  isActive: boolean;
}

/** A stream / group / program: General, Science, Pre-Medical, BS CS, … */
export interface Group {
  id: string;
  kind: InstitutionKind;
  code: string; // 'PRE_MEDICAL'
  name: string; // 'Pre-Medical'
  isActive: boolean;
}

/** A subject / course. `creditHours` is captured but unused until the university phase. */
export interface Subject {
  id: string;
  code: string; // 'PHY'
  name: string; // 'Physics'
  creditHours?: number;
  isActive: boolean;
}

/**
 * Request bodies for `POST /subjects` and `PATCH /subjects/:id`, shared so the web client and
 * the API's Zod schema cannot drift into two different ideas of the same request. The schema
 * stays the source of truth for the *rules* (lengths, allowed characters); these types only fix
 * which fields exist.
 *
 * `creditHours` is deliberately excluded — there is no column for it yet, so accepting one would
 * be a field the API silently discards. `isActive` is excluded too: status is its own route
 * (`PATCH /subjects/:id/status`) rather than a field on the update body.
 */
export type CreateSubjectDto = Pick<Subject, 'code' | 'name'>;
export type UpdateSubjectDto = Partial<CreateSubjectDto>;

export type SubjectType = 'compulsory' | 'elective';

/** Curriculum row: which subject a Level + Group sits, and how. */
export interface CurriculumEntry {
  id: string;
  levelId: string;
  groupId: string;
  subjectId: string;
  subjectType: SubjectType;
  defaultTotalMarks?: number;
  isActive: boolean;
}

/** A curriculum subject resolved with its name — for building exam papers and display. */
export interface CurriculumSubject {
  subjectId: string;
  subject: string; // resolved subject name
  subjectType: SubjectType;
  defaultTotalMarks?: number;
}
