/**
 * SloForm (organism) — the create/edit form for a Student Learning Outcome. An SLO is
 * class + subject specific, so both are chosen here (and locked while editing). The Code
 * must be unique within that class + subject; a Suggest button proposes the next code.
 *
 * Presentational and self-contained: owns the draft, validates it (required fields +
 * unique code), and calls `onSave` with the value. The parent page owns the service
 * calls and injects the `isCodeTaken` / `suggestCode` helpers.
 */
import React, { useState } from 'react';

import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

export interface SloFormValue {
  classId: string;
  subjectId: string;
  code: string;
  name: string;
  description: string;
}

export interface SloFormProps {
  /** Existing values when editing (class + subject are then locked); omitted to create. */
  initialValue?: SloFormValue;
  mode: 'create' | 'edit';
  classOptions: SelectOption[];
  subjectOptions: SelectOption[];
  /** Flags a duplicate code within the chosen class + subject (excludes the edited row). */
  isCodeTaken: (classId: string, subjectId: string, code: string) => boolean;
  /** Proposes the next code for a class + subject. */
  suggestCode: (classId: string, subjectId: string) => string;
  onSave: (value: SloFormValue) => void;
  onCancel: () => void;
}

const EMPTY: SloFormValue = { classId: '', subjectId: '', code: '', name: '', description: '' };

export function SloForm({
  initialValue,
  mode,
  classOptions,
  subjectOptions,
  isCodeTaken,
  suggestCode,
  onSave,
  onCancel,
}: SloFormProps): React.ReactElement {
  const [value, setValue] = useState<SloFormValue>(initialValue ?? EMPTY);
  const locked = mode === 'edit';

  const set = (key: keyof SloFormValue, v: string): void =>
    setValue((prev) => ({ ...prev, [key]: v }));

  const code = value.code.trim();
  const codeError =
    code.length > 0 && isCodeTaken(value.classId, value.subjectId, code)
      ? 'This code already exists for this class + subject.'
      : '';

  const canSave =
    value.classId !== '' &&
    value.subjectId !== '' &&
    code.length > 0 &&
    value.name.trim().length > 0 &&
    !codeError;

  const suggest = (): void => {
    if (value.classId === '' || value.subjectId === '') return;
    set('code', suggestCode(value.classId, value.subjectId));
  };

  const save = (): void =>
    onSave({
      classId: value.classId,
      subjectId: value.subjectId,
      code,
      name: value.name.trim(),
      description: value.description.trim(),
    });

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Class"
          options={classOptions}
          value={value.classId}
          onChange={(v) => set('classId', v)}
          disabled={locked}
          required
        />
        <SelectField
          label="Subject"
          options={subjectOptions}
          value={value.subjectId}
          onChange={(v) => set('subjectId', v)}
          disabled={locked}
          required
        />

        <div>
          <FormField
            id="slo-code"
            name="code"
            label="Code"
            value={value.code}
            onChange={(e) => set('code', e.target.value)}
            error={codeError}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mt-1"
            disabled={value.classId === '' || value.subjectId === ''}
            onClick={suggest}
          >
            Suggest code
          </Button>
        </div>

        <FormField
          id="slo-name"
          name="name"
          label="Name / short title"
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          required
        />
        <FormField
          id="slo-description"
          name="description"
          label="Description (outcome statement)"
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
          required={false}
          containerClassName="sm:col-span-2"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={!canSave} onClick={save}>
          {mode === 'edit' ? 'Save Changes' : 'Add SLO'}
        </Button>
      </div>
    </div>
  );
}

export default SloForm;
