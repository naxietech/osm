import type { AcademicClass, ClassGroup, Subgroup } from '@oses/types';

import type { ClassGroupRecord, ClassRecord } from './ports';

/**
 * Rows → the nested API shape, field by field. The database row is never spread or returned
 * directly, so a column added later (an internal note, a client id, an actor id) cannot reach
 * a caller unless somebody deliberately adds it here.
 */

/**
 * Deactivated rows are withheld.
 *
 * Not merely to keep the form tidy: the caller round-trips the tree it was given, so a
 * deactivated group echoed back — with no `isActive` flag on the wire to mark it — would be read
 * on the next save as "keep this one", and nothing could ever stay deactivated. The reconciler
 * still sees the deactivated rows, which is how re-adding a name revives the original id.
 */
function isLive(row: ClassGroupRecord): boolean {
  return row.isActive;
}

function toSubgroup(row: ClassGroupRecord): Subgroup {
  return { id: row.id, name: row.name, isActive: row.isActive };
}

/**
 * `code` is absent on both shapes on purpose. `@oses/types` allows it, the form has never
 * collected one, and nothing reads it — so there is no column for it and nothing to map.
 */
function toGroup(row: ClassGroupRecord, children: ClassGroupRecord[]): ClassGroup {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    subgroups: children.filter(isLive).map(toSubgroup),
  };
}

/**
 * Nest the flat rows. Subgroups are bucketed by parent in one pass rather than re-scanned per
 * group — the lists are small today, but a scan-per-group is the shape that quietly becomes
 * O(n²) once a class carries thirty groups.
 */
function toGroups(rows: readonly ClassGroupRecord[]): ClassGroup[] {
  const childrenByParent = new Map<string, ClassGroupRecord[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    const siblings = childrenByParent.get(row.parentId);
    if (siblings) siblings.push(row);
    else childrenByParent.set(row.parentId, [row]);
  }

  return rows
    .filter((row) => row.parentId === null && isLive(row))
    .map((row) => toGroup(row, childrenByParent.get(row.id) ?? []));
}

export function toAcademicClass(record: ClassRecord): AcademicClass {
  return {
    id: record.id,
    name: record.name,
    ordinal: record.ordinal,
    ...(record.description !== null ? { description: record.description } : {}),
    isActive: record.isActive,
    version: record.version,
    groups: toGroups(record.groups),
  };
}
