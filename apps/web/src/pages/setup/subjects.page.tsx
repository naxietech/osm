/**
 * Subjects (super admin) — manage the global subjects/courses list the curriculum and
 * exam papers draw from. Gated by `subjects.manage`.
 */
import React from 'react';

import {
  createSubject,
  subjects,
  toggleSubjectActive,
  updateSubject,
} from '@/services/academic.service';

import { type RefItem, ReferenceCrud } from './reference-crud';

export function SubjectsPage(): React.ReactElement {
  return (
    <ReferenceCrud
      title="Subjects"
      subtitle="Manage the subjects and courses used across the curriculum"
      addLabel="Add Subject"
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
