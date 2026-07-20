/**
 * Mock SLO service (frontend only) — super-admin-managed Student Learning Outcomes.
 * Every SLO is class-specific + subject-specific; the management screen picks a class
 * and subject, then edits that combination's flat list. Mutable seed.
 *
 * TODO: replace with a real slosApi; wire question→SLO tagging + per-SLO reports later.
 */
import { type CreateSloDto, type Slo, type UpdateSloDto } from '@oses/types';

import { findLevel, subjects } from './academic.service';

export const slos: Slo[] = [
  {
    id: 'slo_bio9_1',
    classId: 'lvl_9',
    subjectId: 'sub_bio',
    code: '9-BIO-1.1',
    name: 'Cell structure',
    description: 'Explain the structure and function of a cell.',
    isActive: true,
  },
  {
    id: 'slo_bio9_2',
    classId: 'lvl_9',
    subjectId: 'sub_bio',
    code: '9-BIO-1.2',
    name: 'Cell division',
    description: 'Describe the stages of cell division.',
    isActive: true,
  },
  {
    id: 'slo_math9_1',
    classId: 'lvl_9',
    subjectId: 'sub_math',
    code: '9-MATH-1.1',
    name: 'Real numbers',
    description: 'Apply operations on real numbers and their properties.',
    isActive: true,
  },
];

/** SLOs for one class + subject combination (the management list). */
export function listSlos(classId: string, subjectId: string): Slo[] {
  if (!classId || !subjectId) return [];
  return slos.filter((s) => s.classId === classId && s.subjectId === subjectId);
}

let sloCounter = slos.length;

export function createSlo(dto: CreateSloDto): Slo {
  sloCounter += 1;
  const slo: Slo = {
    id: `slo_new_${sloCounter}`,
    classId: dto.classId,
    subjectId: dto.subjectId,
    code: dto.code,
    name: dto.name,
    isActive: true,
    ...(dto.description ? { description: dto.description } : {}),
  };
  slos.push(slo);
  return slo;
}

export function updateSlo(id: string, dto: UpdateSloDto): Slo | undefined {
  const slo = slos.find((s) => s.id === id);
  if (!slo) return undefined;
  if (dto.code !== undefined) slo.code = dto.code;
  if (dto.name !== undefined) slo.name = dto.name;
  if (dto.description !== undefined) slo.description = dto.description;
  if (dto.isActive !== undefined) slo.isActive = dto.isActive;
  return slo;
}

export function toggleSloActive(id: string): void {
  const slo = slos.find((s) => s.id === id);
  if (slo) slo.isActive = !slo.isActive;
}

/**
 * Whether an SLO code already exists within a class + subject (codes must be unique
 * there — per-SLO reports key on them). `exceptId` skips the row being edited.
 */
export function isSloCodeTaken(
  classId: string,
  subjectId: string,
  code: string,
  exceptId?: string,
): boolean {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return false;
  return slos.some(
    (s) =>
      s.classId === classId &&
      s.subjectId === subjectId &&
      s.id !== exceptId &&
      s.code.trim().toLowerCase() === normalized,
  );
}

/**
 * Propose the next SLO code for a class + subject: increment the trailing number of
 * the highest existing code, or seed `{classOrdinal}-{SUBJECT}-1.1` when the list is empty.
 */
export function suggestSloCode(classId: string, subjectId: string): string {
  const existing = slos.filter((s) => s.classId === classId && s.subjectId === subjectId);
  if (existing.length > 0) {
    let bestCode = '';
    let bestN = -1;
    for (const s of existing) {
      const match = s.code.trim().match(/(\d+)\s*$/);
      const n = match ? Number(match[1]) : 0;
      if (n > bestN) {
        bestN = n;
        bestCode = s.code.trim();
      }
    }
    const parts = bestCode.match(/^(.*?)(\d+)(\D*)$/);
    if (parts && parts[2] !== undefined) {
      return `${parts[1] ?? ''}${Number(parts[2]) + 1}${parts[3] ?? ''}`;
    }
    return bestCode ? `${bestCode}-2` : '';
  }
  const level = findLevel(classId);
  const subject = subjects.find((s) => s.id === subjectId);
  if (!level || !subject) return '';
  return `${level.ordinal}-${subject.code}-1.1`;
}

/** One parsed row from an SLO CSV import. */
export interface SloImportRow {
  code: string;
  name: string;
  description?: string;
}

/**
 * Bulk-create SLOs for one class + subject from parsed CSV rows. Rows missing a code or
 * name, or whose code duplicates an existing/earlier-in-batch code, are skipped.
 */
export function importSlos(
  classId: string,
  subjectId: string,
  rows: SloImportRow[],
): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    const code = row.code.trim();
    const name = row.name.trim();
    if (!code || !name || isSloCodeTaken(classId, subjectId, code)) {
      skipped += 1;
      continue;
    }
    createSlo({
      classId,
      subjectId,
      code,
      name,
      ...(row.description && row.description.trim() ? { description: row.description.trim() } : {}),
    });
    created += 1;
  }
  return { created, skipped };
}
