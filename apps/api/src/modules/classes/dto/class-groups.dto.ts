import { z } from 'zod';

/**
 * The nested group/subgroup tree carried on a class write.
 *
 * Two levels, fixed by the schema itself: a group holds subgroups, and a subgroup holds
 * nothing. There is no third level to reject at runtime because there is no third level to
 * express — which is the cheapest possible enforcement of "a subgroup must not have subgroups
 * of its own".
 */

const SPACE = 0x20;
const DELETE_CHAR = 0x7f;

/**
 * Rejects control characters, which have no legitimate place in a name but survive trimming —
 * a name of nothing but a tab would otherwise pass `min(1)` and render as blank everywhere.
 *
 * Written as a scan rather than a regex so the code points are visible as numbers; a character
 * class of literal control characters is unreadable in a diff and easy to corrupt in an edit.
 */
export function printable(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < SPACE || code === DELETE_CHAR) return false;
  }
  return true;
}

/**
 * Caps on tree size. Every route here is Super-Admin-only, so this is not blast-radius control
 * the way the public registration endpoint needs — it is a guard against a runaway client
 * writing thousands of rows a screen could never display, in a table student records will
 * later point at.
 */
const MAX_GROUPS_PER_CLASS = 30;
const MAX_SUBGROUPS_PER_GROUP = 30;

/** Matches the `char_length between 1 and 60` check on both `classes` and `class_groups`. */
const nodeName = z
  .string()
  .trim()
  .min(1, 'A name is required')
  .max(60, 'A name must be at most 60 characters')
  .refine(printable, 'A name contains invalid characters');

/**
 * Sibling names must be unique, compared case-insensitively because the column is `citext` —
 * "Science" and "science" are one row to the database, so accepting both here would only turn
 * a readable 400 into a constraint violation.
 */
function uniqueNames(names: string[]): boolean {
  return new Set(names.map((name) => name.toLowerCase())).size === names.length;
}

const SUBGROUPS_UNIQUE = 'Two subgroups under one group cannot share a name';
const GROUPS_UNIQUE = 'Two groups in one class cannot share a name';
const TOO_MANY_GROUPS = `At most ${MAX_GROUPS_PER_CLASS} groups are allowed`;
const TOO_MANY_SUBGROUPS = `At most ${MAX_SUBGROUPS_PER_GROUP} subgroups are allowed`;

const idField = z.string().uuid('A group id must be a uuid');

/**
 * A subgroup on an update. `id` present means "this is the stored subgroup with this id";
 * absent means "create it".
 *
 * `.strict()` throughout: without it an unrecognised key is dropped in silence, so a caller
 * sending `isActive` would see the request accepted and simply ignored. A 400 naming the field
 * is far easier to act on than a silent no-op.
 */
const SubgroupSchema = z.object({ id: idField.optional(), name: nodeName }).strict();

const GroupSchema = z
  .object({
    id: idField.optional(),
    name: nodeName,
    subgroups: z
      .array(SubgroupSchema)
      .max(MAX_SUBGROUPS_PER_GROUP, TOO_MANY_SUBGROUPS)
      .default([])
      .refine((subgroups) => uniqueNames(subgroups.map((s) => s.name)), SUBGROUPS_UNIQUE),
  })
  .strict();

export const ClassGroupsSchema = z
  .array(GroupSchema)
  .max(MAX_GROUPS_PER_CLASS, TOO_MANY_GROUPS)
  .refine((groups) => uniqueNames(groups.map((g) => g.name)), GROUPS_UNIQUE);

/**
 * The same tree for a create, minus every `id`. A class that does not exist yet cannot own a
 * stored row, so an id here is always a mistake — and because the objects are `.strict()`,
 * sending one is a 400 naming the field rather than a value quietly thrown away.
 */
const NewSubgroupSchema = z.object({ name: nodeName }).strict();

const NewGroupSchema = z
  .object({
    name: nodeName,
    subgroups: z
      .array(NewSubgroupSchema)
      .max(MAX_SUBGROUPS_PER_GROUP, TOO_MANY_SUBGROUPS)
      .default([])
      .refine((subgroups) => uniqueNames(subgroups.map((s) => s.name)), SUBGROUPS_UNIQUE),
  })
  .strict();

export const NewClassGroupsSchema = z
  .array(NewGroupSchema)
  .max(MAX_GROUPS_PER_CLASS, TOO_MANY_GROUPS)
  .refine((groups) => uniqueNames(groups.map((g) => g.name)), GROUPS_UNIQUE);
