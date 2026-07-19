/**
 * SLOs (super admin) — Student Learning Outcomes, managed per Class + Subject.
 * Pick a class and subject at the top; the list below is that combination's flat set
 * of outcomes. Gated by `slos.manage`.
 */
import React, { useMemo, useState } from 'react';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { levelSelectOptions, subjects } from '@/services/academic.service';
import { createSlo, listSlos, toggleSloActive, updateSlo } from '@/services/slo.service';

interface SloRow {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface FormState {
  classId: string;
  subjectId: string;
  code: string;
  name: string;
  description: string;
}

const EMPTY_FORM: FormState = { classId: '', subjectId: '', code: '', name: '', description: '' };
const CLASS_OPTIONS = levelSelectOptions();

function ActiveBadge({ active }: { active: boolean }): React.ReactElement {
  return active ? (
    <span className="rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success-foreground">
      Active
    </span>
  ) : (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      Inactive
    </span>
  );
}

export function SloPage(): React.ReactElement {
  const subjectOptions = useMemo<SelectOption[]>(
    () => subjects.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name })),
    [],
  );

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);

  const selected = classId !== '' && subjectId !== '';
  const rows: SloRow[] = selected
    ? listSlos(classId, subjectId).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description ?? '',
        isActive: s.isActive,
      }))
    : [];

  const openCreate = (): void => {
    setEditingId(null);
    // default the form's link to whatever the filter is showing
    setForm({ ...EMPTY_FORM, classId, subjectId });
    setIsOpen(true);
  };

  const openEdit = (row: SloRow): void => {
    setEditingId(row.id);
    setForm({ classId, subjectId, code: row.code, name: row.name, description: row.description });
    setIsOpen(true);
  };

  const close = (): void => {
    setIsOpen(false);
    setEditingId(null);
  };

  const setField = (key: keyof FormState, value: string): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSave =
    form.classId !== '' &&
    form.subjectId !== '' &&
    form.code.trim().length > 0 &&
    form.name.trim().length > 0;

  const save = (): void => {
    const code = form.code.trim();
    const name = form.name.trim();
    const description = form.description.trim();
    if (editingId) {
      updateSlo(editingId, { code, name, description });
    } else {
      createSlo({
        classId: form.classId,
        subjectId: form.subjectId,
        code,
        name,
        ...(description ? { description } : {}),
      });
      // keep the new SLO visible: point the filter at its class + subject
      setClassId(form.classId);
      setSubjectId(form.subjectId);
    }
    refresh();
    close();
  };

  const handleToggle = (id: string): void => {
    toggleSloActive(id);
    refresh();
  };

  // Changing the class/subject filter closes any open form (its context changed).
  const changeClass = (value: string): void => {
    setClassId(value);
    close();
  };
  const changeSubject = (value: string): void => {
    setSubjectId(value);
    close();
  };

  const columns: ColumnDef<SloRow>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (r) => <span className="font-mono text-sm">{r.code}</span>,
      width: '140px',
    },
    { key: 'name', header: 'Outcome', render: (r) => r.name },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <ActiveBadge active={r.isActive} />,
      width: '120px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(r.id);
            }}
          >
            {r.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
      width: '180px',
    },
  ];

  return (
    <>
      <PageHeader
        title="SLOs"
        subtitle="Student Learning Outcomes — managed per class and subject"
        actions={
          selected &&
          !isOpen && (
            <Button variant="primary" onClick={openCreate}>
              Add SLO
            </Button>
          )
        }
      />

      {/* Class + Subject selector */}
      <div className="mb-6 grid gap-4 rounded-lg border border-border bg-card p-6 shadow-sm sm:grid-cols-2">
        <SelectField
          label="Class"
          options={CLASS_OPTIONS}
          value={classId}
          onChange={changeClass}
          required
        />
        <SelectField
          label="Subject"
          options={subjectOptions}
          value={subjectId}
          onChange={changeSubject}
          required
        />
      </div>

      {!selected ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          Pick a class and subject to view and manage its SLOs.
        </div>
      ) : (
        <>
          {isOpen && (
            <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                {editingId ? 'Edit SLO' : 'Add SLO'}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Class"
                  options={CLASS_OPTIONS}
                  value={form.classId}
                  onChange={(v) => setForm((prev) => ({ ...prev, classId: v }))}
                  disabled={Boolean(editingId)}
                  required
                />
                <SelectField
                  label="Subject"
                  options={subjectOptions}
                  value={form.subjectId}
                  onChange={(v) => setForm((prev) => ({ ...prev, subjectId: v }))}
                  disabled={Boolean(editingId)}
                  required
                />
                <FormField
                  id="slo-code"
                  name="code"
                  label="Code"
                  value={form.code}
                  onChange={(e) => setField('code', e.target.value)}
                  required
                />
                <FormField
                  id="slo-name"
                  name="name"
                  label="Name / short title"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                />
                <FormField
                  id="slo-description"
                  name="description"
                  label="Description (outcome statement)"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  required={false}
                  containerClassName="sm:col-span-2"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={!canSave} onClick={save}>
                  {editingId ? 'Save Changes' : 'Add SLO'}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <DataTable<SloRow>
              data={rows}
              columns={columns}
              emptyMessage="No SLOs for this class + subject yet"
            />
          </div>
        </>
      )}
    </>
  );
}

export default SloPage;
