/**
 * ClassHierarchyForm (organism) — the create/edit form for a Class and its inline
 * Class → Group → Subgroup tree. Enter the class name (+ order, description), tick
 * "Has group?" to reveal group fields, and per group tick "Has subgroup?" to reveal
 * subgroup fields.
 *
 * Presentational and self-contained: owns the draft, validates it (names required +
 * unique within their parent), and calls `onSave` with a cleaned value. Each existing
 * group/subgroup carries its original `id` so the parent's save PRESERVES references
 * (students/exams that point at a group/subgroup are not orphaned by an edit).
 */
import React, { useRef, useState } from 'react';

import { Button } from '@/design-system/atoms/button';
import { Plus, X } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';

/** Group/subgroup as emitted on save (id preserved for existing rows, omitted for new). */
export interface ClassHierarchyGroup {
  id?: string;
  name: string;
  subgroups: Array<{ id?: string; name: string }>;
}
export interface ClassHierarchyValue {
  name: string;
  ordinal: string;
  description: string;
  groups: ClassHierarchyGroup[];
}

export interface ClassHierarchyFormProps {
  initialValue?: ClassHierarchyValue;
  mode: 'create' | 'edit';
  onSave: (value: ClassHierarchyValue) => void;
  onCancel: () => void;
}

interface SubgroupDraft {
  key: number;
  id?: string;
  name: string;
}
interface GroupDraft {
  key: number;
  id?: string;
  name: string;
  hasSubgroup: boolean;
  subgroups: SubgroupDraft[];
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

export function ClassHierarchyForm({
  initialValue,
  mode,
  onSave,
  onCancel,
}: ClassHierarchyFormProps): React.ReactElement {
  const keyRef = useRef(0);
  const nextKey = (): number => {
    keyRef.current += 1;
    return keyRef.current;
  };

  const [name, setName] = useState(initialValue?.name ?? '');
  const [ordinal, setOrdinal] = useState(initialValue?.ordinal ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [hasGroup, setHasGroup] = useState((initialValue?.groups.length ?? 0) > 0);
  const [groups, setGroups] = useState<GroupDraft[]>(() =>
    (initialValue?.groups ?? []).map((g) => ({
      key: nextKey(),
      ...(g.id ? { id: g.id } : {}),
      name: g.name,
      hasSubgroup: g.subgroups.length > 0,
      subgroups: g.subgroups.map((s) => ({
        key: nextKey(),
        ...(s.id ? { id: s.id } : {}),
        name: s.name,
      })),
    })),
  );

  const newGroup = (): GroupDraft => ({
    key: nextKey(),
    name: '',
    hasSubgroup: false,
    subgroups: [],
  });
  const newSubgroup = (): SubgroupDraft => ({ key: nextKey(), name: '' });

  const toggleHasGroup = (checked: boolean): void => {
    setHasGroup(checked);
    setGroups((prev) => (checked ? (prev.length > 0 ? prev : [newGroup()]) : []));
  };

  const addGroup = (): void => setGroups((p) => [...p, newGroup()]);
  const setGroupName = (gi: number, value: string): void =>
    setGroups((p) => p.map((g, i) => (i === gi ? { ...g, name: value } : g)));
  const removeGroup = (gi: number): void => setGroups((p) => p.filter((_, i) => i !== gi));

  const toggleHasSubgroup = (gi: number, checked: boolean): void =>
    setGroups((p) =>
      p.map((g, i) =>
        i === gi
          ? {
              ...g,
              hasSubgroup: checked,
              subgroups: checked ? (g.subgroups.length > 0 ? g.subgroups : [newSubgroup()]) : [],
            }
          : g,
      ),
    );
  const addSubgroup = (gi: number): void =>
    setGroups((p) =>
      p.map((g, i) => (i === gi ? { ...g, subgroups: [...g.subgroups, newSubgroup()] } : g)),
    );
  const setSubgroupName = (gi: number, si: number, value: string): void =>
    setGroups((p) =>
      p.map((g, i) =>
        i === gi
          ? { ...g, subgroups: g.subgroups.map((s, j) => (j === si ? { ...s, name: value } : s)) }
          : g,
      ),
    );
  const removeSubgroup = (gi: number, si: number): void =>
    setGroups((p) =>
      p.map((g, i) => (i === gi ? { ...g, subgroups: g.subgroups.filter((_, j) => j !== si) } : g)),
    );

  // ---- validation: names required + unique within their parent ----
  const groupNameError = (gi: number): string => {
    const g = groups[gi];
    if (!g) return '';
    const n = g.name.trim();
    if (n === '') return 'Group name is required.';
    const dup = groups.some((o, i) => i !== gi && o.name.trim().toLowerCase() === n.toLowerCase());
    return dup ? 'Group name must be unique.' : '';
  };
  const subgroupNameError = (gi: number, si: number): string => {
    const g = groups[gi];
    const s = g?.subgroups[si];
    if (!g || !s) return '';
    const m = s.name.trim();
    if (m === '') return 'Subgroup name is required.';
    const dup = g.subgroups.some(
      (o, j) => j !== si && o.name.trim().toLowerCase() === m.toLowerCase(),
    );
    return dup ? 'Subgroup name must be unique.' : '';
  };

  const groupsValid = (): boolean => {
    if (!hasGroup) return true;
    return groups.every(
      (g, gi) =>
        groupNameError(gi) === '' &&
        (!g.hasSubgroup || g.subgroups.every((_, si) => subgroupNameError(gi, si) === '')),
    );
  };

  const canSave = name.trim().length > 0 && groupsValid();

  const save = (): void => {
    const cleanGroups: ClassHierarchyGroup[] = hasGroup
      ? groups.map((g) => ({
          ...(g.id ? { id: g.id } : {}),
          name: g.name.trim(),
          subgroups: g.hasSubgroup
            ? g.subgroups.map((s) => ({ ...(s.id ? { id: s.id } : {}), name: s.name.trim() }))
            : [],
        }))
      : [];
    onSave({
      name: name.trim(),
      ordinal: ordinal.trim(),
      description: description.trim(),
      groups: cleanGroups,
    });
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="class-name"
          name="name"
          label="Class Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FormField
          id="class-ordinal"
          name="ordinal"
          type="number"
          label="Order"
          value={ordinal}
          onChange={(e) => setOrdinal(e.target.value)}
          required={false}
        />
        <FormField
          id="class-description"
          name="description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required={false}
          containerClassName="sm:col-span-2"
        />
      </div>

      {/* Has group? */}
      <div className="mt-4 border-t border-border pt-4">
        <Checkbox checked={hasGroup} onChange={toggleHasGroup} label="Has group?" />

        {hasGroup && (
          <div className="mt-3 space-y-4">
            {groups.map((group, gi) => {
              const gErr = groupNameError(gi);
              return (
                <div key={group.key} className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Group ${gi + 1} name`}
                      placeholder="Group (e.g. Science)"
                      value={group.name}
                      error={Boolean(gErr)}
                      onChange={(e) => setGroupName(gi, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove group ${gi + 1}`}
                      onClick={() => removeGroup(gi)}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  {gErr && <p className="mt-1 text-xs text-danger-foreground">{gErr}</p>}

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
                          {group.subgroups.map((sg, si) => {
                            const sErr = subgroupNameError(gi, si);
                            return (
                              <li key={sg.key}>
                                <div className="flex items-center gap-2">
                                  <span className="w-5 shrink-0 text-xs text-muted-foreground">
                                    {si + 1}.
                                  </span>
                                  <Input
                                    aria-label={`Group ${gi + 1} subgroup ${si + 1}`}
                                    placeholder="Subgroup (e.g. Biology)"
                                    value={sg.name}
                                    error={Boolean(sErr)}
                                    onChange={(e) => setSubgroupName(gi, si, e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Remove subgroup ${si + 1}`}
                                    onClick={() => removeSubgroup(gi, si)}
                                  >
                                    <X className="h-4 w-4" aria-hidden />
                                  </Button>
                                </div>
                                {sErr && (
                                  <p className="ml-7 mt-1 text-xs text-danger-foreground">{sErr}</p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        <Button
                          type="button"
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
              );
            })}

            <Button type="button" variant="secondary" size="sm" onClick={addGroup}>
              <Plus className="h-4 w-4" aria-hidden />
              Add Group
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={!canSave} onClick={save}>
          {mode === 'edit' ? 'Save Changes' : 'Add Class'}
        </Button>
      </div>
    </div>
  );
}

export default ClassHierarchyForm;
