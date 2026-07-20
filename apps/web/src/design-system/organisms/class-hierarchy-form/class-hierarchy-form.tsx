/**
 * ClassHierarchyForm (organism) — the create/edit form for a Class and its inline
 * Class → Group → Subgroup tree. Enter the class name (+ order, description), tick
 * "Has group?" to reveal group fields, and per group tick "Has subgroup?" to reveal
 * subgroup fields.
 *
 * Presentational and self-contained: Formik + Yup own the draft and validation (names
 * required + unique within their parent), and `onSave` receives a cleaned value. Each
 * existing group/subgroup carries its original `id` so the parent's save PRESERVES
 * references (students/exams pointing at a group/subgroup are not orphaned by an edit).
 *
 * Rows use Formik's FieldArray but keep their own `key`: Formik does not solve React
 * keying, and an index key loses focus/state when rows are added or removed.
 */
import React, { useRef } from 'react';

import { FieldArray, FormikProvider, useFormik } from 'formik';
import * as Yup from 'yup';

import { Button } from '@/design-system/atoms/button';
import { Checkbox } from '@/design-system/atoms/checkbox';
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

interface ClassFormValues {
  name: string;
  ordinal: string;
  description: string;
  hasGroup: boolean;
  groups: GroupDraft[];
}

// ---- validation rules: names required + unique within their parent ----
// Pure and module-level so the Yup schema (which gates the save button) and the inline
// row messages are driven by the SAME rule and cannot disagree.

function groupNameError(groups: GroupDraft[], gi: number): string {
  const g = groups[gi];
  if (!g) return '';
  const n = g.name.trim();
  if (n === '') return 'Group name is required.';
  const dup = groups.some((o, i) => i !== gi && o.name.trim().toLowerCase() === n.toLowerCase());
  return dup ? 'Group name must be unique.' : '';
}

function subgroupNameError(groups: GroupDraft[], gi: number, si: number): string {
  const g = groups[gi];
  const s = g?.subgroups[si];
  if (!g || !s) return '';
  const m = s.name.trim();
  if (m === '') return 'Subgroup name is required.';
  const dup = g.subgroups.some(
    (o, j) => j !== si && o.name.trim().toLowerCase() === m.toLowerCase(),
  );
  return dup ? 'Subgroup name must be unique.' : '';
}

function groupsValid(groups: GroupDraft[]): boolean {
  return groups.every(
    (g, gi) =>
      groupNameError(groups, gi) === '' &&
      (!g.hasSubgroup || g.subgroups.every((_, si) => subgroupNameError(groups, gi, si) === '')),
  );
}

/**
 * Yup hands a test the partially-cast value, where a field the user has not reached yet
 * can be absent. Coerce to a well-formed tree so the rules above stay total functions.
 */
function asGroups(value: unknown): GroupDraft[] {
  if (!Array.isArray(value)) return [];
  return (value as Array<Partial<GroupDraft>>).map((g, i) => ({
    key: g.key ?? i,
    name: typeof g.name === 'string' ? g.name : '',
    hasSubgroup: Boolean(g.hasSubgroup),
    subgroups: Array.isArray(g.subgroups)
      ? (g.subgroups as Array<Partial<SubgroupDraft>>).map((s, j) => ({
          key: s.key ?? j,
          name: typeof s.name === 'string' ? s.name : '',
        }))
      : [],
  }));
}

const validationSchema = Yup.object({
  name: Yup.string().trim().required('Class name is required'),
  ordinal: Yup.string(),
  description: Yup.string(),
  hasGroup: Yup.boolean(),
  groups: Yup.mixed().test('groups-valid', 'Fix the group names.', (value, ctx) => {
    const { hasGroup } = ctx.parent as ClassFormValues;
    if (!hasGroup) return true;
    return groupsValid(asGroups(value));
  }),
});

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

  const newGroup = (): GroupDraft => ({
    key: nextKey(),
    name: '',
    hasSubgroup: false,
    subgroups: [],
  });
  const newSubgroup = (): SubgroupDraft => ({ key: nextKey(), name: '' });

  const formik = useFormik<ClassFormValues>({
    initialValues: {
      name: initialValue?.name ?? '',
      ordinal: initialValue?.ordinal ?? '',
      description: initialValue?.description ?? '',
      hasGroup: (initialValue?.groups.length ?? 0) > 0,
      groups: (initialValue?.groups ?? []).map((g) => ({
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
    },
    validationSchema,
    // The save button reflects validity from the first render, before any field is touched.
    validateOnMount: true,
    onSubmit: (values) => {
      const cleanGroups: ClassHierarchyGroup[] = values.hasGroup
        ? values.groups.map((g) => ({
            ...(g.id ? { id: g.id } : {}),
            name: g.name.trim(),
            subgroups: g.hasSubgroup
              ? g.subgroups.map((s) => ({ ...(s.id ? { id: s.id } : {}), name: s.name.trim() }))
              : [],
          }))
        : [];
      onSave({
        name: values.name.trim(),
        ordinal: values.ordinal.trim(),
        description: values.description.trim(),
        groups: cleanGroups,
      });
    },
  });

  const { hasGroup, groups } = formik.values;

  const setGroups = (next: GroupDraft[]): void => void formik.setFieldValue('groups', next, true);

  const mutateGroup = (gi: number, patch: Partial<GroupDraft>): void =>
    setGroups(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  const toggleHasGroup = (checked: boolean): void => {
    void formik.setValues(
      {
        ...formik.values,
        hasGroup: checked,
        groups: checked ? (groups.length > 0 ? groups : [newGroup()]) : [],
      },
      true,
    );
  };

  const toggleHasSubgroup = (gi: number, checked: boolean): void => {
    const g = groups[gi];
    if (!g) return;
    mutateGroup(gi, {
      hasSubgroup: checked,
      subgroups: checked ? (g.subgroups.length > 0 ? g.subgroups : [newSubgroup()]) : [],
    });
  };

  const setSubgroups = (gi: number, subgroups: SubgroupDraft[]): void =>
    mutateGroup(gi, { subgroups });

  const addSubgroup = (gi: number): void =>
    setSubgroups(gi, [...(groups[gi]?.subgroups ?? []), newSubgroup()]);
  const setSubgroupName = (gi: number, si: number, value: string): void =>
    setSubgroups(
      gi,
      (groups[gi]?.subgroups ?? []).map((s, j) => (j === si ? { ...s, name: value } : s)),
    );
  const removeSubgroup = (gi: number, si: number): void =>
    setSubgroups(
      gi,
      (groups[gi]?.subgroups ?? []).filter((_, j) => j !== si),
    );

  return (
    <FormikProvider value={formik}>
      <form onSubmit={formik.handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="class-name"
            name="name"
            label="Class Name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name ? formik.errors.name : undefined}
            required
          />
          <FormField
            id="class-ordinal"
            name="ordinal"
            type="number"
            label="Order"
            value={formik.values.ordinal}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            required={false}
          />
          <FormField
            id="class-description"
            name="description"
            label="Description"
            value={formik.values.description}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            required={false}
            containerClassName="sm:col-span-2"
          />
        </div>

        {/* Has group? */}
        <div className="mt-4 border-t border-border pt-4">
          <Checkbox
            checked={hasGroup}
            onChange={(e) => toggleHasGroup(e.target.checked)}
            label="Has group?"
          />

          {hasGroup && (
            <FieldArray name="groups">
              {(helpers) => (
                <div className="mt-3 space-y-4">
                  {groups.map((group, gi) => {
                    const gErr = groupNameError(groups, gi);
                    return (
                      <div key={group.key} className="rounded-lg border border-border p-4">
                        <div className="flex items-center gap-2">
                          <Input
                            aria-label={`Group ${gi + 1} name`}
                            placeholder="Group (e.g. Science)"
                            value={group.name}
                            error={Boolean(gErr)}
                            onChange={(e) => mutateGroup(gi, { name: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove group ${gi + 1}`}
                            onClick={() => helpers.remove(gi)}
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                        {gErr && <p className="mt-1 text-xs text-danger-foreground">{gErr}</p>}

                        {/* Has subgroup? */}
                        <div className="mt-3 pl-4">
                          <Checkbox
                            checked={group.hasSubgroup}
                            onChange={(e) => toggleHasSubgroup(gi, e.target.checked)}
                            label="Has subgroup?"
                          />
                          {group.hasSubgroup && (
                            <div className="mt-2">
                              <ul className="space-y-2">
                                {group.subgroups.map((sg, si) => {
                                  const sErr = subgroupNameError(groups, gi, si);
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
                                        <p className="ml-7 mt-1 text-xs text-danger-foreground">
                                          {sErr}
                                        </p>
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

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => helpers.push(newGroup())}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add Group
                  </Button>
                </div>
              )}
            </FieldArray>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!formik.isValid}>
            {mode === 'edit' ? 'Save Changes' : 'Add Class'}
          </Button>
        </div>
      </form>
    </FormikProvider>
  );
}

export default ClassHierarchyForm;
