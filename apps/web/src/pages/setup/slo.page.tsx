/**
 * SLOs (super admin) — Student Learning Outcomes, managed per Class + Subject.
 * Pick a class and subject at the top; the list below is that combination's flat set
 * of outcomes. Supports single add/edit (via the SloForm organism) and CSV bulk import.
 * Gated by `slos.manage`.
 */
import React, { useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Upload } from '@/design-system/atoms/icon';
import { Alert } from '@/design-system/molecules/alert';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';
import { ActiveBadge } from '@/design-system/molecules/status-badge';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import { SloForm, type SloFormValue } from '@/design-system/organisms/slo-form';
import { levelSelectOptions, subjects } from '@/services/academic.service';
import {
  type SloImportRow,
  createSlo,
  importSlos,
  isSloCodeTaken,
  listSlos,
  suggestSloCode,
  toggleSloActive,
  updateSlo,
} from '@/services/slo.service';

interface SloRow {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

const CLASS_OPTIONS = levelSelectOptions();

/** Parse a simple `code,name,description` CSV (optional header). */
function parseSloCsv(text: string): SloImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const rows: SloImportRow[] = [];
  lines.forEach((line, i) => {
    const cells = line.split(',').map((c) => c.trim());
    if (i === 0 && cells[0]?.toLowerCase() === 'code') return; // header
    const code = cells[0] ?? '';
    const name = cells[1] ?? '';
    const description = cells[2] ?? '';
    if (!code && !name) return;
    rows.push({ code, name, ...(description ? { description } : {}) });
  });
  return rows;
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
  const [importRows, setImportRows] = useState<SloImportRow[] | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(
    null,
  );
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const editing = editingId
    ? listSlos(classId, subjectId).find((s) => s.id === editingId)
    : undefined;
  const initialValue: SloFormValue | undefined = editing
    ? {
        classId,
        subjectId,
        code: editing.code,
        name: editing.name,
        description: editing.description ?? '',
      }
    : undefined;

  const clearImport = (): void => {
    setImportRows(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const openCreate = (): void => {
    setEditingId(null);
    clearImport();
    setImportResult(null);
    setIsOpen(true);
  };
  const openEdit = (row: SloRow): void => {
    setEditingId(row.id);
    clearImport();
    setImportResult(null);
    setIsOpen(true);
  };
  const close = (): void => {
    setIsOpen(false);
    setEditingId(null);
  };

  const handleSave = (value: SloFormValue): void => {
    if (editingId) {
      updateSlo(editingId, {
        code: value.code,
        name: value.name,
        description: value.description,
      });
    } else {
      createSlo({
        classId: value.classId,
        subjectId: value.subjectId,
        code: value.code,
        name: value.name,
        ...(value.description ? { description: value.description } : {}),
      });
      // keep the new SLO visible: point the filter at its class + subject
      setClassId(value.classId);
      setSubjectId(value.subjectId);
    }
    refresh();
    close();
  };

  const handleToggle = (id: string): void => {
    toggleSloActive(id);
    refresh();
  };

  // Changing the class/subject filter resets the open form + import (context changed).
  const changeClass = (value: string): void => {
    setClassId(value);
    close();
    clearImport();
    setImportResult(null);
  };
  const changeSubject = (value: string): void => {
    setSubjectId(value);
    close();
    clearImport();
    setImportResult(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOpen(false);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = () => setImportRows(parseSloCsv(String(reader.result ?? '')));
    reader.readAsText(file);
  };

  const importPreview = useMemo(() => {
    if (!importRows) return null;
    const seen = new Set<string>();
    let willImport = 0;
    for (const r of importRows) {
      const code = r.code.trim().toLowerCase();
      const valid =
        r.code.trim().length > 0 &&
        r.name.trim().length > 0 &&
        !seen.has(code) &&
        !isSloCodeTaken(classId, subjectId, r.code);
      if (valid) {
        willImport += 1;
        seen.add(code);
      }
    }
    return { total: importRows.length, willImport, willSkip: importRows.length - willImport };
  }, [importRows, classId, subjectId]);

  const confirmImport = (): void => {
    if (!importRows) return;
    const result = importSlos(classId, subjectId, importRows);
    setImportResult(result);
    clearImport();
    refresh();
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
      key: 'description',
      header: 'Outcome statement',
      render: (r) =>
        r.description ? (
          <span className="line-clamp-1 text-muted-foreground">{r.description}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
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
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" aria-hidden />
                Import CSV
              </Button>
              <Button variant="primary" onClick={openCreate}>
                Add SLO
              </Button>
            </div>
          )
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFile}
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
          {importResult && (
            <Alert className="mb-6">
              Imported {importResult.created} SLO{importResult.created === 1 ? '' : 's'}
              {importResult.skipped > 0
                ? ` · skipped ${importResult.skipped} (duplicate or incomplete)`
                : ''}
              .
            </Alert>
          )}

          {importPreview && (
            <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Import preview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {importPreview.total} row{importPreview.total === 1 ? '' : 's'} parsed —{' '}
                <span className="font-medium text-foreground">{importPreview.willImport}</span> new,{' '}
                {importPreview.willSkip} skipped (duplicate or incomplete). Expected columns:{' '}
                <span className="font-mono text-xs">code, name, description</span>.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={clearImport}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={importPreview.willImport === 0}
                  onClick={confirmImport}
                >
                  Import {importPreview.willImport} SLO{importPreview.willImport === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          )}

          {isOpen && (
            <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                {editingId ? 'Edit SLO' : 'Add SLO'}
              </h2>
              <SloForm
                key={editingId ?? 'new'}
                mode={editingId ? 'edit' : 'create'}
                initialValue={
                  initialValue ?? { classId, subjectId, code: '', name: '', description: '' }
                }
                classOptions={CLASS_OPTIONS}
                subjectOptions={subjectOptions}
                isCodeTaken={(c, s, code) => isSloCodeTaken(c, s, code, editingId ?? undefined)}
                suggestCode={suggestSloCode}
                onSave={handleSave}
                onCancel={close}
              />
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
