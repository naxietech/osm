import type { ClassGroupInput } from '@oses/types';

import {
  type ClassGroupRecord,
  DuplicateClassGroupIdError,
  type KeptNode,
  MisplacedClassGroupError,
  type NewGroup,
  type NewSubgroup,
  type TreeMutationPlan,
  UnknownClassGroupError,
} from './ports';

/**
 * Two names refer to the same node when they match case-insensitively, because `name` is
 * `citext` — the database would treat "science" and "Science" as one row on the unique index,
 * so the reconciler has to as well or it would plan an insert the database then refuses.
 */
function sameNode(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Whether a surviving row needs writing at all. An unchanged, already-active row is left
 * alone rather than rewritten with identical values — otherwise every save would bump
 * `updated_at` on the whole tree and the column would stop meaning anything.
 */
function needsWrite(row: ClassGroupRecord, name: string, sortOrder: number): boolean {
  return row.name !== name || row.sortOrder !== sortOrder || !row.isActive;
}

/**
 * Work out what to do to a class's stored tree so it matches the one submitted.
 *
 * Four cases, per node:
 *
 * - **kept** — the payload carries its id. Renamed if the name changed, switched back on if
 *   it was off, otherwise left entirely alone.
 * - **added** — no id, and no deactivated sibling by that name. Inserted.
 * - **revived** — no id, but a sibling already holds that name. That row is reclaimed (and
 *   switched back on if it was off) rather than a second one inserted. Note this matches an
 *   *active* sibling too, not only a deactivated one: a client that resubmits a group by name
 *   without its id means the same group, and treating it as new would only earn a duplicate-
 *   name refusal. For a deactivated sibling it matters more still — the unique index does not
 *   exclude inactive rows, so the admin would face an error about a group they cannot see.
 *   Reclaiming also keeps the id, so anything already pointing at that group still does.
 * - **dropped** — stored but unmentioned. Deactivated, never deleted. A group's subgroups are
 *   never visited when the group itself is dropped, so they fall into the same bucket and the
 *   tree can never hold an active subgroup under a deactivated group.
 *
 * Depth is capped at two by construction: the payload has exactly two levels, and any id sent
 * at the wrong level is refused rather than moved. That is what enforces "a subgroup must not
 * have subgroups of its own" — the rule no CHECK constraint can express.
 *
 * @param existing every stored row for the class, **including deactivated ones**
 * @param incoming the submitted tree, already validated by Zod (trimmed, non-empty, siblings
 *                 unique) so this function only has to reason about identity, not formatting
 */
export function reconcileTree(
  existing: readonly ClassGroupRecord[],
  incoming: readonly ClassGroupInput[],
): TreeMutationPlan {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const childrenOf = (parentId: string | null): ClassGroupRecord[] =>
    existing.filter((row) => row.parentId === parentId);

  const insertGroups: NewGroup[] = [];
  const insertSubgroups: NewSubgroup[] = [];
  const keep: KeptNode[] = [];

  /** Every id that survives this save — whether written or left untouched. */
  const surviving = new Set<string>();

  /**
   * Claim a stored row for a payload entry, refusing anything that would move it. Returns the
   * row so the caller can decide whether it needs writing.
   */
  const claim = (id: string, expectedParentId: string | null): ClassGroupRecord => {
    const row = byId.get(id);
    if (!row) throw new UnknownClassGroupError(id);
    if (surviving.has(id)) throw new DuplicateClassGroupIdError(id);

    if (row.parentId !== expectedParentId) {
      const reason =
        expectedParentId === null
          ? 'it is a subgroup, and a subgroup cannot become a top-level group'
          : row.parentId === null
            ? 'it is a group, and a group cannot become a subgroup'
            : 'it belongs to a different group, and groups cannot be moved';
      throw new MisplacedClassGroupError(id, reason);
    }

    surviving.add(id);
    return row;
  };

  /** A deactivated or unclaimed sibling holding this name, if there is one. */
  const findByName = (parentId: string | null, name: string): ClassGroupRecord | undefined =>
    childrenOf(parentId).find((row) => !surviving.has(row.id) && sameNode(row.name, name));

  // Position is the payload's own order, scoped to the parent and 1-based. Submitting a
  // reordered tree is therefore all a reorder takes, whenever the form grows the affordance.
  incoming.forEach((group, groupIndex) => {
    const groupSortOrder = groupIndex + 1;
    // Omitted and empty mean the same thing — the group has no subgroups. The Zod schema
    // defaults it, so this only guards callers that bypass validation (the unit tests).
    const submittedSubgroups = group.subgroups ?? [];
    let groupId: string | null = null;

    if (group.id !== undefined) {
      const row = claim(group.id, null);
      groupId = row.id;
      if (needsWrite(row, group.name, groupSortOrder)) {
        keep.push({ id: row.id, name: group.name, sortOrder: groupSortOrder });
      }
    } else {
      const revived = findByName(null, group.name);
      if (revived) {
        groupId = claim(revived.id, null).id;
        if (needsWrite(revived, group.name, groupSortOrder)) {
          keep.push({ id: revived.id, name: group.name, sortOrder: groupSortOrder });
        }
      }
    }

    if (groupId === null) {
      // A group that does not exist yet cannot own a row that does. An id here is either
      // unknown or belongs elsewhere in this class — either way it is not ours to re-home.
      for (const subgroup of submittedSubgroups) {
        if (subgroup.id === undefined) continue;
        if (!byId.has(subgroup.id)) throw new UnknownClassGroupError(subgroup.id);
        throw new MisplacedClassGroupError(
          subgroup.id,
          'it cannot be moved under a group that is being created',
        );
      }
      insertGroups.push({
        name: group.name,
        sortOrder: groupSortOrder,
        subgroups: submittedSubgroups.map((s) => s.name),
      });
      return;
    }

    const parentId = groupId;
    submittedSubgroups.forEach((subgroup, subgroupIndex) => {
      const sortOrder = subgroupIndex + 1;

      if (subgroup.id !== undefined) {
        const row = claim(subgroup.id, parentId);
        if (needsWrite(row, subgroup.name, sortOrder)) {
          keep.push({ id: row.id, name: subgroup.name, sortOrder });
        }
        return;
      }

      const revived = findByName(parentId, subgroup.name);
      if (revived) {
        claim(revived.id, parentId);
        if (needsWrite(revived, subgroup.name, sortOrder)) {
          keep.push({ id: revived.id, name: subgroup.name, sortOrder });
        }
      } else {
        insertSubgroups.push({ parentId, name: subgroup.name, sortOrder });
      }
    });
  });

  const deactivate = existing
    .filter((row) => row.isActive && !surviving.has(row.id))
    .map((row) => row.id);

  return { insertGroups, insertSubgroups, keep, deactivate };
}

/** The tree a brand-new class starts with. Only inserts are possible — there is nothing to diff. */
export function toInitialGroups(incoming: readonly ClassGroupInput[]): NewGroup[] {
  return incoming.map((group, index) => ({
    name: group.name,
    sortOrder: index + 1,
    subgroups: (group.subgroups ?? []).map((subgroup) => subgroup.name),
  }));
}
