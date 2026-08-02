import { z } from 'zod';

/**
 * Rejects control characters, which have no legitimate place in a label but survive trimming.
 * Written as a character-code scan rather than a regex so the control range is stated in
 * readable hex instead of literal control bytes sitting invisibly in this file.
 */
function printable(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

/**
 * The limits mirror the `subjects_code_chk` / `subjects_name_chk` check constraints exactly. Kept
 * in both places on purpose: the database is the guarantee, this is the readable 400 that stops a
 * constraint violation ever surfacing as a 500.
 */
const codeField = z
  .string()
  .trim()
  .min(1, 'Code is required')
  .max(20, 'Code must be at most 20 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'Code may contain only letters, numbers, dashes and underscores');

const nameField = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters')
  .refine(printable, 'Name contains invalid characters');

export const CreateSubjectSchema = z.object({ code: codeField, name: nameField }).strict();
export type CreateSubjectRequestDto = z.infer<typeof CreateSubjectSchema>;

/**
 * Both fields optional, but not both absent: an empty patch would spend a write bumping
 * `updated_at` and `updated_by` while changing nothing a user asked to change. Rejecting it names
 * the mistake instead of reporting success for a request that did nothing.
 *
 * `.strict()` matters as much as the field rules — without it, a caller sending `isActive` here
 * (which belongs on the status route) would get a 200 and no change at all.
 */
export const UpdateSubjectSchema = z
  .object({ code: codeField.optional(), name: nameField.optional() })
  .strict()
  .refine(
    (patch) => patch.code !== undefined || patch.name !== undefined,
    'Send at least one of code or name',
  );
export type UpdateSubjectRequestDto = z.infer<typeof UpdateSubjectSchema>;

/** An explicit target state rather than a blind toggle, so a double submit is idempotent. */
export const UpdateSubjectStatusSchema = z.object({ isActive: z.boolean() }).strict();
export type UpdateSubjectStatusDto = z.infer<typeof UpdateSubjectStatusSchema>;

/**
 * `?activeOnly=true` for pickers. A query string carries no types, so the value arrives as text
 * and only the exact string `true` opts in — a stray `?activeOnly=0` or `?activeOnly=no` must not
 * be read as "yes" by JavaScript truthiness.
 */
export const ListSubjectsQuerySchema = z
  .object({ activeOnly: z.enum(['true', 'false']).optional() })
  .strict()
  .transform((query) => ({ activeOnly: query.activeOnly === 'true' }));
export type ListSubjectsQueryDto = z.infer<typeof ListSubjectsQuerySchema>;
