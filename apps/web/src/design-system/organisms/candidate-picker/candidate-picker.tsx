/**
 * CandidatePicker (organism) — bulk student selection for exam registration.
 *
 * A controlled component: the parent (ExamRegisterPage) owns the selection and gets a
 * new selection map on every change. Search by name to find students quickly; ticked
 * students may then choose any number of elective papers (toggle chips). Kept decoupled
 * from the services via the minimal PickerStudent shape.
 */
import React, { useMemo, useState } from 'react';

import { Input } from '@/design-system/atoms/input';
import { type SelectOption } from '@/design-system/molecules/select-field';
import { cn } from '@/lib/utils';

export interface PickerStudent {
  studentRefId: string;
  fullName: string;
  gradeId: number;
}

/** studentRefId -> chosen elective ExamPaper.ids. Presence of the key = selected. */
export type CandidateSelectionMap = Record<string, string[]>;

export interface CandidatePickerProps {
  students: PickerStudent[];
  /** Elective papers offered by the exam: value = ExamPaper.id, label = subject. */
  electives: SelectOption[];
  value: CandidateSelectionMap;
  onChange: (next: CandidateSelectionMap) => void;
}

export function CandidatePicker({
  students,
  electives,
  value,
  onChange,
}: CandidatePickerProps): React.ReactElement {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query === ''
      ? students
      : students.filter((s) => s.fullName.toLowerCase().includes(query));
  }, [students, search]);

  const selectedCount = Object.keys(value).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => value[s.studentRefId]);

  const toggleAllFiltered = (): void => {
    const next = { ...value };
    if (allFilteredSelected) {
      filtered.forEach((s) => delete next[s.studentRefId]);
    } else {
      filtered.forEach((s) => {
        next[s.studentRefId] = value[s.studentRefId] ?? [];
      });
    }
    onChange(next);
  };

  const toggleOne = (ref: string): void => {
    const next = { ...value };
    if (next[ref]) delete next[ref];
    else next[ref] = [];
    onChange(next);
  };

  const toggleElective = (ref: string, paperId: string): void => {
    const current = value[ref] ?? [];
    const nextChoices = current.includes(paperId)
      ? current.filter((p) => p !== paperId)
      : [...current, paperId];
    onChange({ ...value, [ref]: nextChoices });
  };

  if (students.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No eligible students to register. Students must be active and in this exam&apos;s grade.
      </p>
    );
  }

  return (
    <div>
      {/* toolbar: search + select-all */}
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 max-w-xs text-sm"
          aria-label="Search students by name"
        />
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAllFiltered}
            disabled={filtered.length === 0}
            className="h-4 w-4 rounded border-input accent-brand"
          />
          Select all
          <span className="font-normal text-muted-foreground">({selectedCount} selected)</span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No students match your search.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((student) => {
            const chosen = value[student.studentRefId];
            const isSelected = Boolean(chosen);
            return (
              <li
                key={student.studentRefId}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(student.studentRefId)}
                    className="h-4 w-4 rounded border-input accent-brand"
                  />
                  <span>
                    <span className="font-medium text-foreground">{student.fullName}</span>
                    <span className="block text-xs text-muted-foreground">
                      Grade {student.gradeId} ·{' '}
                      <span className="font-mono">{student.studentRefId}</span>
                    </span>
                  </span>
                </label>

                {electives.length > 0 && (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {electives.map((opt) => {
                      const active = Boolean(chosen?.includes(opt.value));
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!isSelected}
                          onClick={() => toggleElective(student.studentRefId, opt.value)}
                          aria-pressed={active}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            active
                              ? 'border-brand bg-brand-subtle text-brand'
                              : 'border-border text-muted-foreground hover:bg-muted',
                            !isSelected && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CandidatePicker;
