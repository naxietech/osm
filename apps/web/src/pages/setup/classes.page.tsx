/**
 * Classes (super admin) — the Class → Group → Subgroup hierarchy (TRD). One form:
 * enter the class name (+ description), tick "Has group?" to reveal group fields, and
 * per group tick "Has subgroup?" to reveal subgroup fields. Groups have no separate
 * module — they are authored here. This is the source of truth for a class's groups/
 * subgroups that student registration and exam creation read. Gated by `levels.manage`.
 */
import React, { useRef, useState } from 'react';

import { PageHeader } from '@/components/widgets';
import { Button } from '@/design-system/atoms/button';
import { Plus, X } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';
import { type ColumnDef, DataTable } from '@/design-system/organisms/data-table';
import {
  classGroupsFor,
  createLevel,
  levels,
  replaceClassGroups,
  toggleLevelActive,
  updateLevel,
} from '@/services/academic.service';

interface SubgroupDraft {
  key: number;
  name: string;
}
interface GroupDraft {
  key: number;
  name: string;
  hasSubgroup: boolean;
  subgroups: SubgroupDraft[];
}
interface ClassForm {
  name: string;
  ordinal: string;
  description: string;
  hasGroup: boolean;
  groups: GroupDraft[];
}

interface ClassRow {
  id: string;
  name: string;
  description: string;
  groupCount: number;
  isActive: boolean;
}

const EMPTY_FORM: ClassForm = {
  name: '',
  ordinal: '',
  description: '',
  hasGroup: false,
  groups: [],
};

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

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}): React.ReactElement {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input accent-[var(--brand)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function ClassesPage(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [, setTick] = useState(0);
  const refresh = (): void => setTick((t) => t + 1);

  // Stable local keys for draft rows (no Date.now/random in this environment).
  const keyRef = useRef(0);
  const nextKey = (): number => {
    keyRef.current += 1;
    return keyRef.current;
  };

  const rows: ClassRow[] = levels
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description ?? '',
      groupCount: (l.classGroups ?? []).length,
      isActive: l.isActive,
    }));

  const openCreate = (): void => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  };

  const openEdit = (id: string): void => {
    const level = levels.find((l) => l.id === id);
    if (!level) return;
    const groups: GroupDraft[] = classGroupsFor(id).map((g) => ({
      key: nextKey(),
      name: g.name,
      hasSubgroup: g.subgroups.length > 0,
      subgroups: g.subgroups.map((s) => ({ key: nextKey(), name: s.name })),
    }));
    setEditingId(id);
    setForm({
      name: level.name,
      ordinal: String(level.ordinal),
      description: level.description ?? '',
      hasGroup: groups.length > 0,
      groups,
    });
    setIsOpen(true);
  };

  const close = (): void => {
    setIsOpen(false);
    setEditingId(null);
  };

  // ---- group / subgroup draft editing ----
  const newGroup = (): GroupDraft => ({
    key: nextKey(),
    name: '',
    hasSubgroup: false,
    subgroups: [],
  });

  const toggleHasGroup = (checked: boolean): void =>
    setForm((p) => ({
      ...p,
      hasGroup: checked,
      groups: checked ? (p.groups.length > 0 ? p.groups : [newGroup()]) : [],
    }));

  const addGroup = (): void => setForm((p) => ({ ...p, groups: [...p.groups, newGroup()] }));
  const setGroupName = (gi: number, name: string): void =>
    setForm((p) => ({
      ...p,
      groups: p.groups.map((g, i) => (i === gi ? { ...g, name } : g)),
    }));
  const removeGroup = (gi: number): void =>
    setForm((p) => ({ ...p, groups: p.groups.filter((_, i) => i !== gi) }));

  const toggleHasSubgroup = (gi: number, checked: boolean): void =>
    setForm((p) => ({
      ...p,
      groups: p.groups.map((g, i) =>
        i === gi
          ? {
              ...g,
              hasSubgroup: checked,
              subgroups: checked
                ? g.subgroups.length > 0
                  ? g.subgroups
                  : [{ key: nextKey(), name: '' }]
                : [],
            }
          : g,
      ),
    }));
  const addSubgroup = (gi: number): void =>
    setForm((p) => ({
      ...p,
      groups: p.groups.map((g, i) =>
        i === gi ? { ...g, subgroups: [...g.subgroups, { key: nextKey(), name: '' }] } : g,
      ),
    }));
  const setSubgroupName = (gi: number, si: number, name: string): void =>
    setForm((p) => ({
      ...p,
      groups: p.groups.map((g, i) =>
        i === gi
          ? { ...g, subgroups: g.subgroups.map((s, j) => (j === si ? { ...s, name } : s)) }
          : g,
      ),
    }));
  const removeSubgroup = (gi: number, si: number): void =>
    setForm((p) => ({
      ...p,
      groups: p.groups.map((g, i) =>
        i === gi ? { ...g, subgroups: g.subgroups.filter((_, j) => j !== si) } : g,
      ),
    }));

  const canSave = form.name.trim().length > 0;

  const save = (): void => {
    const groupInputs = form.hasGroup
      ? form.groups.map((g) => ({
          name: g.name,
          subgroups: g.hasSubgroup ? g.subgroups.map((s) => ({ name: s.name })) : [],
        }))
      : [];

    if (editingId) {
      updateLevel(editingId, {
        name: form.name.trim(),
        ordinal: Number(form.ordinal || '0'),
        description: form.description.trim(),
      });
      replaceClassGroups(editingId, groupInputs);
    } else {
      const created = createLevel({
        name: form.name.trim(),
        ordinal: Number(form.ordinal || '0'),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      });
      replaceClassGroups(created.id, groupInputs);
    }
    refresh();
    close();
  };

  const handleToggleActive = (id: string): void => {
    toggleLevelActive(id);
    refresh();
  };

  const columns: ColumnDef<ClassRow>[] = [
    { key: 'name', header: 'Class', render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'description',
      header: 'Description',
      render: (r) =>
        r.description ? r.description : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'groupCount',
      header: 'Groups',
      render: (r) =>
        r.groupCount > 0 ? `${r.groupCount}` : <span className="text-muted-foreground">—</span>,
      width: '100px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <ActiveBadge active={r.isActive} />,
      width: '110px',
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
              openEdit(r.id);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleActive(r.id);
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
        title="Classes"
        subtitle="Add a class, then its groups and subgroups"
        actions={
          !isOpen && (
            <Button variant="primary" onClick={openCreate}>
              Add Class
            </Button>
          )
        }
      />

      {isOpen && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {editingId ? 'Edit Class' : 'Add Class'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="class-name"
              name="name"
              label="Class Name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <FormField
              id="class-ordinal"
              name="ordinal"
              type="number"
              label="Order"
              value={form.ordinal}
              onChange={(e) => setForm((p) => ({ ...p, ordinal: e.target.value }))}
              required={false}
            />
            <FormField
              id="class-description"
              name="description"
              label="Description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              required={false}
              containerClassName="sm:col-span-2"
            />
          </div>

          {/* Has group? */}
          <div className="mt-4 border-t border-border pt-4">
            <Checkbox checked={form.hasGroup} onChange={toggleHasGroup} label="Has group?" />

            {form.hasGroup && (
              <div className="mt-3 space-y-4">
                {form.groups.map((group, gi) => (
                  <div key={group.key} className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Group ${gi + 1} name`}
                        placeholder="Group (e.g. Science)"
                        value={group.name}
                        onChange={(e) => setGroupName(gi, e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove group ${gi + 1}`}
                        onClick={() => removeGroup(gi)}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>

                    {/* Has subgroup? */}
                    <div className="mt-3 pl-4">
                      <Checkbox
                        checked={group.hasSubgroup}
                        onChange={(v) => toggleHasSubgroup(gi, v)}
                        label="Has subgroup?"
                      />
                      {group.hasSubgroup && (
                        <div className="mt-2">
                          <ul className="space-y-2">
                            {group.subgroups.map((sg, si) => (
                              <li key={sg.key} className="flex items-center gap-2">
                                <span className="w-5 shrink-0 text-xs text-muted-foreground">
                                  {si + 1}.
                                </span>
                                <Input
                                  aria-label={`Group ${gi + 1} subgroup ${si + 1}`}
                                  placeholder="Subgroup (e.g. Biology)"
                                  value={sg.name}
                                  onChange={(e) => setSubgroupName(gi, si, e.target.value)}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Remove subgroup ${si + 1}`}
                                  onClick={() => removeSubgroup(gi, si)}
                                >
                                  <X className="h-4 w-4" aria-hidden />
                                </Button>
                              </li>
                            ))}
                          </ul>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => addSubgroup(gi)}
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                            Add Subgroup
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <Button variant="secondary" size="sm" onClick={addGroup}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add Group
                </Button>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={save}>
              {editingId ? 'Save Changes' : 'Add Class'}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <DataTable<ClassRow>
          data={rows}
          columns={columns}
          onRowClick={(r) => openEdit(r.id)}
          emptyMessage="No classes yet"
        />
      </div>
    </>
  );
}

export default ClassesPage;
