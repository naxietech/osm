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

/**
 * A class as the API stores and returns it — the live shape behind `GET /classes`.
 *
 * Distinct from {@link Level} on purpose. `Level` requires `kind` ({@link InstitutionKind}),
 * which the API does not store and which nothing in the product ever sets to anything but
 * `school`; making it optional would be a breaking change to a type six mock screens depend
 * on, for no gain today. When those screens migrate, `Level` goes and this stays.
 *
 * `groups` carries the whole active tree, so a list response is enough to open the edit form
 * without a second request. Deactivated groups and subgroups are withheld — the form
 * round-trips what it is given, so a retired row echoed back would read as "restore this".
 *
 * `version` is the optimistic-lock counter: send back the one you loaded and the update
 * applies only while it still matches.
 */
export interface AcademicClass {
  id: string;
  name: string; // 'Class 9'
  ordinal: number; // progression order — 'Class 10' must not sort before 'Class 9'
  description?: string;
  isActive: boolean;
  version: number;
  groups: ClassGroup[];
}

/** A subgroup as submitted on a class write. No `id` means "create this one". */
export interface SubgroupInput {
  id?: string;
  name: string;
}

/**
 * A group as submitted on a class write, with its subgroups. No `id` means "create this one".
 *
 * `subgroups` may be omitted, which means the group has none — the same thing an empty array
 * says. Unlike `groups` on the class itself, there is no "leave it alone" reading to preserve:
 * a group's subgroups are only ever submitted as part of that group.
 */
export interface ClassGroupInput {
  id?: string;
  name: string;
  subgroups?: SubgroupInput[];
}

/**
 * `POST /classes`. Omitting `groups` creates a class with no tree — which is what Class 1–8
 * are: no flag, no empty list to reason about, simply no rows.
 */
export interface CreateClassDto {
  name: string;
  ordinal: number;
  description?: string;
  groups?: ClassGroupInput[];
}

/**
 * `PATCH /classes/:id`. Every field is optional except `version`, but **`groups` is special**:
 * omitting it leaves the stored tree untouched, whereas sending it replaces the tree by
 * comparison. Anything stored for this class that a submitted tree does not mention is
 * deactivated — never deleted, because a million student rows will carry these ids.
 */
export interface UpdateClassDto {
  version: number;
  name?: string;
  ordinal?: number;
  description?: string | null;
  groups?: ClassGroupInput[];
}

/** `PATCH /classes/:id/status` — an explicit target state, so a double submit is idempotent. */
export interface UpdateClassStatusDto {
  isActive: boolean;
}

/**
 * A configurable level: Class 1–12 (school), 1st/2nd Year (college), Semester (university).
 *
 * **MOCK-ONLY.** Superseded by {@link AcademicClass}, which is what the live `/classes` API
 * returns. This shape is still read by the exam, checker, student and SLO mock screens and
 * survives until the last of them migrates. New code wants `AcademicClass`.
 */
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
