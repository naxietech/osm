/**
 * Mock academic-structure service (frontend only). Serves the Admin-managed reference
 * data — Levels, Groups/Programs, Subjects/Courses and the Curriculum — that Students
 * and Exams reference. Seeded for schools (Class 9–12). The CRUD screens to manage this
 * data are a follow-up; here it is read-only seed used by the student/exam forms.
 * TODO: Replace with a real academicApi + Admin management screens.
 */
import {
  type ClassGroup,
  type CurriculumEntry,
  type CurriculumSubject,
  type Group,
  InstitutionKind,
  type Level,
  type Subgroup,
  type Subject,
  type SubjectType,
} from '@oses/types';

const LATENCY = 300;
function delay<T>(value: T): Promise<T> {
  return new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY));
}

// ---- levels (school) — each carries the inline Class → Group → Subgroup structure ----
export const levels: Level[] = [
  {
    id: 'lvl_9',
    kind: InstitutionKind.SCHOOL,
    name: 'Class 9',
    ordinal: 9,
    description: 'Secondary — SSC Part I',
    isActive: true,
    classGroups: [
      {
        id: 'grp_science',
        name: 'Science',
        code: 'SCIENCE',
        isActive: true,
        subgroups: [
          { id: 'sg_9_bio', name: 'Biology', code: 'BIO', isActive: true },
          { id: 'sg_9_cs', name: 'Computer Science', code: 'CS', isActive: true },
        ],
      },
      { id: 'grp_general', name: 'General', code: 'GENERAL', isActive: true, subgroups: [] },
    ],
  },
  {
    id: 'lvl_10',
    kind: InstitutionKind.SCHOOL,
    name: 'Class 10',
    ordinal: 10,
    description: 'Secondary — SSC Part II',
    isActive: true,
    classGroups: [
      {
        id: 'grp_science',
        name: 'Science',
        code: 'SCIENCE',
        isActive: true,
        subgroups: [
          { id: 'sg_10_bio', name: 'Biology', code: 'BIO', isActive: true },
          { id: 'sg_10_cs', name: 'Computer Science', code: 'CS', isActive: true },
        ],
      },
      { id: 'grp_general', name: 'General', code: 'GENERAL', isActive: true, subgroups: [] },
    ],
  },
  {
    id: 'lvl_11',
    kind: InstitutionKind.SCHOOL,
    name: 'Class 11',
    ordinal: 11,
    description: 'Higher Secondary — HSSC Part I',
    isActive: true,
    classGroups: [
      { id: 'grp_premed', name: 'Pre-Medical', code: 'PRE_MEDICAL', isActive: true, subgroups: [] },
      { id: 'grp_ics', name: 'ICS (Computer Science)', code: 'ICS', isActive: true, subgroups: [] },
    ],
  },
  {
    id: 'lvl_12',
    kind: InstitutionKind.SCHOOL,
    name: 'Class 12',
    ordinal: 12,
    description: 'Higher Secondary — HSSC Part II',
    isActive: true,
    classGroups: [
      { id: 'grp_premed', name: 'Pre-Medical', code: 'PRE_MEDICAL', isActive: true, subgroups: [] },
    ],
  },
];

// ---- groups / streams ----
export const groups: Group[] = [
  {
    id: 'grp_science',
    kind: InstitutionKind.SCHOOL,
    code: 'SCIENCE',
    name: 'Science',
    isActive: true,
  },
  {
    id: 'grp_general',
    kind: InstitutionKind.SCHOOL,
    code: 'GENERAL',
    name: 'General',
    isActive: true,
  },
  {
    id: 'grp_premed',
    kind: InstitutionKind.SCHOOL,
    code: 'PRE_MEDICAL',
    name: 'Pre-Medical',
    isActive: true,
  },
  {
    id: 'grp_preeng',
    kind: InstitutionKind.SCHOOL,
    code: 'PRE_ENGINEERING',
    name: 'Pre-Engineering',
    isActive: true,
  },
  {
    id: 'grp_ics',
    kind: InstitutionKind.SCHOOL,
    code: 'ICS',
    name: 'ICS (Computer Science)',
    isActive: true,
  },
  {
    id: 'grp_commerce',
    kind: InstitutionKind.SCHOOL,
    code: 'COMMERCE',
    name: 'Commerce',
    isActive: true,
  },
  { id: 'grp_arts', kind: InstitutionKind.SCHOOL, code: 'ARTS', name: 'Arts', isActive: true },
];

// ---- subjects ----
export const subjects: Subject[] = [
  { id: 'sub_eng', code: 'ENG', name: 'English', isActive: true },
  { id: 'sub_urd', code: 'URD', name: 'Urdu', isActive: true },
  { id: 'sub_isl', code: 'ISL', name: 'Islamiat', isActive: true },
  { id: 'sub_pak', code: 'PAK', name: 'Pakistan Studies', isActive: true },
  { id: 'sub_math', code: 'MATH', name: 'Mathematics', isActive: true },
  { id: 'sub_phy', code: 'PHY', name: 'Physics', isActive: true },
  { id: 'sub_chem', code: 'CHEM', name: 'Chemistry', isActive: true },
  { id: 'sub_bio', code: 'BIO', name: 'Biology', isActive: true },
  { id: 'sub_cs', code: 'CS', name: 'Computer Science', isActive: true },
];

// ---- curriculum seed: [levelId, groupId, rows of [subjectId, type, marks]] ----
type SeedRow = [string, SubjectType, number];
const SCIENCE_9_10: SeedRow[] = [
  ['sub_eng', 'compulsory', 75],
  ['sub_urd', 'compulsory', 75],
  ['sub_isl', 'compulsory', 50],
  ['sub_math', 'compulsory', 75],
  ['sub_phy', 'compulsory', 65],
  ['sub_chem', 'compulsory', 65],
  ['sub_bio', 'elective', 65],
  ['sub_cs', 'elective', 65],
];
const PRE_MEDICAL: SeedRow[] = [
  ['sub_eng', 'compulsory', 100],
  ['sub_urd', 'compulsory', 100],
  ['sub_isl', 'compulsory', 50],
  ['sub_phy', 'compulsory', 85],
  ['sub_chem', 'compulsory', 85],
  ['sub_bio', 'compulsory', 85],
];

const SEED: Array<[string, string, SeedRow[]]> = [
  ['lvl_9', 'grp_science', SCIENCE_9_10],
  ['lvl_10', 'grp_science', SCIENCE_9_10],
  [
    'lvl_10',
    'grp_general',
    [
      ['sub_eng', 'compulsory', 75],
      ['sub_urd', 'compulsory', 75],
      ['sub_isl', 'compulsory', 50],
      ['sub_pak', 'compulsory', 50],
      ['sub_math', 'compulsory', 75],
      ['sub_cs', 'elective', 65],
    ],
  ],
  ['lvl_11', 'grp_premed', PRE_MEDICAL],
  [
    'lvl_11',
    'grp_ics',
    [
      ['sub_eng', 'compulsory', 100],
      ['sub_urd', 'compulsory', 100],
      ['sub_isl', 'compulsory', 50],
      ['sub_math', 'compulsory', 100],
      ['sub_phy', 'compulsory', 85],
      ['sub_cs', 'compulsory', 85],
    ],
  ],
  ['lvl_12', 'grp_premed', PRE_MEDICAL],
];

let curriculumCounter = 0;
export const curriculum: CurriculumEntry[] = SEED.flatMap(([levelId, groupId, rows]) =>
  rows.map(([subjectId, subjectType, defaultTotalMarks]) => {
    curriculumCounter += 1;
    return {
      id: `cur_${curriculumCounter}`,
      levelId,
      groupId,
      subjectId,
      subjectType,
      defaultTotalMarks,
      isActive: true,
    };
  }),
);

// ---- synchronous lookups (used by other mock services for resolving names) ----
export function findLevel(id: string): Level | undefined {
  return levels.find((l) => l.id === id);
}
export function levelName(id: string): string {
  return findLevel(id)?.name ?? '—';
}
export function levelOrdinal(id: string): number {
  return findLevel(id)?.ordinal ?? 0;
}
export function groupName(id: string): string {
  return groups.find((g) => g.id === id)?.name ?? '—';
}

/**
 * Resolve a list of subject ids to names. An unknown id falls back to the id itself
 * rather than being dropped, so a stale reference stays visible instead of silently
 * shortening the list.
 */
export function subjectNames(ids: string[]): string[] {
  return ids.map((id) => subjects.find((s) => s.id === id)?.name ?? id);
}

/** Resolve a list of class/level ids to names. Same fallback rule as subjectNames. */
export function levelNames(ids: string[]): string[] {
  return ids.map((id) => findLevel(id)?.name ?? id);
}

// ---- class hierarchy (Class → Group → Subgroup) reads ----
/** A class's inline groups (the TRD hierarchy; source of truth for a class's groups). */
export function classGroupsFor(classId: string): ClassGroup[] {
  return findLevel(classId)?.classGroups ?? [];
}
/** Subgroups under a class's group. */
export function subgroupsFor(classId: string, groupId: string): Subgroup[] {
  return classGroupsFor(classId).find((g) => g.id === groupId)?.subgroups ?? [];
}
/** Active group options for a class (for form selects). */
export function classGroupOptions(classId: string): Array<{ value: string; label: string }> {
  return classGroupsFor(classId)
    .filter((g) => g.isActive)
    .map((g) => ({ value: g.id, label: g.name }));
}
/** Active subgroup options under a class's group (for form selects). */
export function subgroupOptions(
  classId: string,
  groupId: string,
): Array<{ value: string; label: string }> {
  return subgroupsFor(classId, groupId)
    .filter((s) => s.isActive)
    .map((s) => ({ value: s.id, label: s.name }));
}
export function subgroupName(classId: string, groupId: string, subgroupId: string): string {
  return subgroupsFor(classId, groupId).find((s) => s.id === subgroupId)?.name ?? '—';
}

/** Group options per class (from the class hierarchy), keyed by class id — for form selects. */
export function classGroupOptionsByLevelMap(): Record<
  string,
  Array<{ value: string; label: string }>
> {
  const map: Record<string, Array<{ value: string; label: string }>> = {};
  for (const level of levels) map[level.id] = classGroupOptions(level.id);
  return map;
}

/** Subgroup options keyed by `${classId}:${groupId}` — for the class → group → subgroup cascade. */
export function subgroupOptionsByLevelGroupMap(): Record<
  string,
  Array<{ value: string; label: string }>
> {
  const map: Record<string, Array<{ value: string; label: string }>> = {};
  for (const level of levels) {
    for (const group of classGroupsFor(level.id)) {
      map[`${level.id}:${group.id}`] = subgroupOptions(level.id, group.id);
    }
  }
  return map;
}

/** Level options for a form's Level select (sorted by progression). */
export function levelSelectOptions(
  kind: InstitutionKind = InstitutionKind.SCHOOL,
): Array<{ value: string; label: string }> {
  return levels
    .filter((l) => l.kind === kind && l.isActive)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((l) => ({ value: l.id, label: l.name }));
}

/** Group options keyed by level id — a level's valid groups come from the curriculum. */
export function groupOptionsByLevelMap(): Record<string, Array<{ value: string; label: string }>> {
  const map: Record<string, Array<{ value: string; label: string }>> = {};
  for (const level of levels) {
    const groupIds = new Set(
      curriculum.filter((c) => c.levelId === level.id && c.isActive).map((c) => c.groupId),
    );
    map[level.id] = groups
      .filter((g) => groupIds.has(g.id) && g.isActive)
      .map((g) => ({ value: g.id, label: g.name }));
  }
  return map;
}

function resolveCurriculum(levelId: string, groupId: string): CurriculumSubject[] {
  return curriculum
    .filter((c) => c.levelId === levelId && c.groupId === groupId && c.isActive)
    .map((c) => {
      const item: CurriculumSubject = {
        subjectId: c.subjectId,
        subject: subjects.find((s) => s.id === c.subjectId)?.name ?? c.subjectId,
        subjectType: c.subjectType,
      };
      if (c.defaultTotalMarks !== undefined) item.defaultTotalMarks = c.defaultTotalMarks;
      return item;
    });
}

/** Synchronous curriculum resolver — for forms that pre-fill papers from the curriculum. */
export function curriculumSubjectsFor(levelId: string, groupId: string): CurriculumSubject[] {
  return resolveCurriculum(levelId, groupId);
}

// ---- service (async, mirrors the other mock services) ----
function listLevels(kind: InstitutionKind = InstitutionKind.SCHOOL): Promise<Level[]> {
  return delay(
    levels.filter((l) => l.kind === kind && l.isActive).sort((a, b) => a.ordinal - b.ordinal),
  );
}

/** Groups valid for a level = those that have curriculum defined for it. */
function listGroupsForLevel(levelId: string): Promise<Group[]> {
  const groupIds = new Set(
    curriculum.filter((c) => c.levelId === levelId && c.isActive).map((c) => c.groupId),
  );
  return delay(groups.filter((g) => groupIds.has(g.id) && g.isActive));
}

function getCurriculum(levelId: string, groupId: string): Promise<CurriculumSubject[]> {
  return delay(resolveCurriculum(levelId, groupId));
}

export const academicService = {
  listLevels,
  listGroupsForLevel,
  getCurriculum,
};

// ---- mutations (super-admin reference-data management) ----
let subjectCounter = subjects.length;
let levelCounter = levels.length;
let groupCounter = groups.length;

export function createSubject(input: {
  code: string;
  name: string;
  creditHours?: number;
}): Subject {
  subjectCounter += 1;
  const subject: Subject = {
    id: `sub_new_${subjectCounter}`,
    code: input.code,
    name: input.name,
    isActive: true,
    ...(input.creditHours !== undefined ? { creditHours: input.creditHours } : {}),
  };
  subjects.push(subject);
  return subject;
}
export function updateSubject(
  id: string,
  input: { code?: string; name?: string; creditHours?: number },
): Subject | undefined {
  const subject = subjects.find((s) => s.id === id);
  if (!subject) return undefined;
  if (input.code !== undefined) subject.code = input.code;
  if (input.name !== undefined) subject.name = input.name;
  if (input.creditHours !== undefined) subject.creditHours = input.creditHours;
  return subject;
}
export function toggleSubjectActive(id: string): void {
  const subject = subjects.find((s) => s.id === id);
  if (subject) subject.isActive = !subject.isActive;
}

export function createLevel(input: {
  name: string;
  ordinal: number;
  description?: string;
  kind?: InstitutionKind;
}): Level {
  levelCounter += 1;
  const level: Level = {
    id: `lvl_new_${levelCounter}`,
    kind: input.kind ?? InstitutionKind.SCHOOL,
    name: input.name,
    ordinal: input.ordinal,
    isActive: true,
    classGroups: [],
    ...(input.description ? { description: input.description } : {}),
  };
  levels.push(level);
  return level;
}
export function updateLevel(
  id: string,
  input: { name?: string; ordinal?: number; description?: string },
): Level | undefined {
  const level = levels.find((l) => l.id === id);
  if (!level) return undefined;
  if (input.name !== undefined) level.name = input.name;
  if (input.ordinal !== undefined) level.ordinal = input.ordinal;
  if (input.description !== undefined) level.description = input.description;
  return level;
}
export function toggleLevelActive(id: string): void {
  const level = levels.find((l) => l.id === id);
  if (level) level.isActive = !level.isActive;
}

// ---- class hierarchy mutations (Class → Group → Subgroup management) ----
let classGroupCounter = 0;
let subgroupCounter = 0;

/** Input shape for authoring a class's group/subgroup tree in one submit. */
export interface SubgroupInput {
  /** Existing subgroup id to preserve on edit; omit for a new subgroup. */
  id?: string;
  name: string;
  code?: string;
}
export interface ClassGroupInput {
  /** Existing group id to preserve on edit; omit for a new group. */
  id?: string;
  name: string;
  code?: string;
  subgroups: SubgroupInput[];
}

/**
 * Replace a class's entire group/subgroup tree from the Class form (single submit).
 * Blank names are dropped. Ids passed on inputs are PRESERVED (so students/exams that
 * reference an existing group/subgroup keep pointing at it); only new rows get fresh ids.
 */
export function replaceClassGroups(classId: string, groups: ClassGroupInput[]): void {
  const level = findLevel(classId);
  if (!level) return;
  level.classGroups = groups
    .filter((g) => g.name.trim().length > 0)
    .map((g): ClassGroup => {
      let groupId = g.id;
      if (!groupId) {
        classGroupCounter += 1;
        groupId = `cg_${classGroupCounter}`;
      }
      return {
        id: groupId,
        name: g.name.trim(),
        isActive: true,
        ...(g.code ? { code: g.code } : {}),
        subgroups: g.subgroups
          .filter((s) => s.name.trim().length > 0)
          .map((s): Subgroup => {
            let subgroupId = s.id;
            if (!subgroupId) {
              subgroupCounter += 1;
              subgroupId = `sg_${subgroupCounter}`;
            }
            return {
              id: subgroupId,
              name: s.name.trim(),
              isActive: true,
              ...(s.code ? { code: s.code } : {}),
            };
          }),
      };
    });
}

export function createGroup(input: { code: string; name: string; kind?: InstitutionKind }): Group {
  groupCounter += 1;
  const group: Group = {
    id: `grp_new_${groupCounter}`,
    kind: input.kind ?? InstitutionKind.SCHOOL,
    code: input.code,
    name: input.name,
    isActive: true,
  };
  groups.push(group);
  return group;
}
export function updateGroup(
  id: string,
  input: { code?: string; name?: string },
): Group | undefined {
  const group = groups.find((g) => g.id === id);
  if (!group) return undefined;
  if (input.code !== undefined) group.code = input.code;
  if (input.name !== undefined) group.name = input.name;
  return group;
}
export function toggleGroupActive(id: string): void {
  const group = groups.find((g) => g.id === id);
  if (group) group.isActive = !group.isActive;
}
