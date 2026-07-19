/**
 * Mock SLO service (frontend only) — super-admin-managed Student Learning Outcomes.
 * Every SLO is class-specific + subject-specific; the management screen picks a class
 * and subject, then edits that combination's flat list. Mutable seed.
 *
 * TODO: replace with a real slosApi; wire question→SLO tagging + per-SLO reports later.
 */
import { type CreateSloDto, type Slo, type UpdateSloDto } from '@oses/types';

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
