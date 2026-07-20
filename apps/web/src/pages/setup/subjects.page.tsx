/**
 * Subjects (super admin) — manage the global subjects/courses list the curriculum and
 * exam papers draw from. Gated by `subjects.manage`.
 *
 * Uses the shared ReferenceCrud with its opt-in features: a unique `code`, a search box,
 * and a usage column that guards deactivating a subject still referenced by the
 * curriculum, SLOs, or exams.
 */
import React from 'react';

import {
  createSubject,
  curriculum,
  subjects,
  toggleSubjectActive,
  updateSubject,
} from '@/services/academic.service';
import { exams } from '@/services/mock-store';
import { slos } from '@/services/slo.service';

import { type RefItem, ReferenceCrud } from './reference-crud';

/** How many curriculum entries, SLOs, and exams reference a subject. */
function subjectUsage(subjectId: string): number {
  const inCurriculum = curriculum.filter((c) => c.subjectId === subjectId).length;
  const inSlos = slos.filter((s) => s.subjectId === subjectId).length;
  const inExams = exams.filter((e) => (e.subjectIds ?? []).includes(subjectId)).length;
  return inCurriculum + inSlos + inExams;
}

export function SubjectsPage(): React.ReactElement {
  return (
    <ReferenceCrud
      title="Subjects"
      subtitle="Manage the subjects and courses used across the curriculum"
      addLabel="Add Subject"
      searchable
      uniqueKeys={['code']}
      usage={{ header: 'In use by', get: (item) => subjectUsage(item.id) }}
      fields={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'creditHours', label: 'Credit Hours', type: 'number', required: false },
      ]}
      getItems={() =>
        subjects.map(
          (s): RefItem => ({
            id: s.id,
            isActive: s.isActive,
            code: s.code,
            name: s.name,
            creditHours: s.creditHours ?? '',
          }),
        )
      }
      onCreate={(v) =>
        createSubject({
          code: v.code ?? '',
          name: v.name ?? '',
          ...(v.creditHours ? { creditHours: Number(v.creditHours) } : {}),
        })
      }
      onUpdate={(id, v) =>
        updateSubject(id, {
          code: v.code ?? '',
          name: v.name ?? '',
          ...(v.creditHours ? { creditHours: Number(v.creditHours) } : {}),
        })
      }
      onToggleActive={(item) => toggleSubjectActive(item.id)}
    />
  );
}

export default SubjectsPage;
