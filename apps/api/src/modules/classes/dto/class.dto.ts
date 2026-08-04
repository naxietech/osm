import { z } from 'zod';

import type { CreateClassDto, UpdateClassDto, UpdateClassStatusDto } from '@oses/types';

import { ClassGroupsSchema, NewClassGroupsSchema, printable } from './class-groups.dto';

/**
 * Validators for the class routes. The shapes live in `@oses/types`; the `satisfies` on each
 * schema ties the two together, so a field added on one side without the other fails the build
 * instead of drifting quietly. Zod stays the source of truth for the *rules* — the shared type
 * only fixes which fields exist.
 */

/** Matches the `char_length between 1 and 60` check on `classes.name`. */
const nameField = z
  .string()
  .trim()
  .min(1, 'Class name is required')
  .max(60, 'Class name must be at most 60 characters')
  .refine(printable, 'Class name contains invalid characters');

/**
 * Progression order, mirroring the `between 1 and 99` check on the column. Required rather
 * than derived: sorted by name, "Class 10" comes before "Class 9", and only the admin knows
 * where a newly added class belongs in the sequence.
 *
 * Deliberately not unique — two classes may briefly share an ordinal while an admin is midway
 * through reordering them, and refusing that would make reordering impossible without a
 * scratch value.
 */
const ordinalField = z
  .number()
  .int('Order must be a whole number')
  .min(1, 'Order must be at least 1')
  .max(99, 'Order must be at most 99');

/** Matches the `char_length <= 200` check on `classes.description`. */
const descriptionField = z
  .string()
  .trim()
  .max(200, 'Description must be at most 200 characters')
  .refine(printable, 'Description contains invalid characters');

export const CreateClassSchema = z
  .object({
    name: nameField,
    ordinal: ordinalField,
    description: descriptionField.optional(),
    groups: NewClassGroupsSchema.optional(),
  })
  .strict() satisfies z.ZodType<CreateClassDto>;
export type CreateClassRequestDto = z.infer<typeof CreateClassSchema>;

/**
 * `version` is mandatory: it is the copy the caller loaded, and the update applies only while
 * it still matches.
 *
 * **Omitting `groups` leaves the stored tree untouched** — sending an empty array is what
 * clears it. That distinction matters more here than it does for category questions: a class
 * write that defaulted a missing tree to `[]` would deactivate every group the class has, so
 * renaming a class from a client that does not know about groups would quietly dismantle it.
 */
export const UpdateClassSchema = z
  .object({
    version: z.number().int().positive('Version must be a positive integer'),
    name: nameField.optional(),
    ordinal: ordinalField.optional(),
    description: descriptionField.nullable().optional(),
    groups: ClassGroupsSchema.optional(),
  })
  .strict() satisfies z.ZodType<UpdateClassDto>;
export type UpdateClassRequestDto = z.infer<typeof UpdateClassSchema>;

/** An explicit target state rather than a blind toggle, so a double submit is idempotent. */
export const UpdateClassStatusSchema = z
  .object({ isActive: z.boolean() })
  .strict() satisfies z.ZodType<UpdateClassStatusDto>;
export type UpdateClassStatusRequestDto = z.infer<typeof UpdateClassStatusSchema>;
