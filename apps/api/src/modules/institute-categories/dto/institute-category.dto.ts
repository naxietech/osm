import { z } from 'zod';

import { questionTypeHasOptions } from '@oses/types';

/**
 * Every limit here is deliberate, not decorative. Question text and option values are served to
 * an unauthenticated audience on the public registration endpoint, so an unbounded payload would
 * be shipped to every visitor of the registration link. These caps are the blast-radius control
 * on the only route that answers anonymous callers.
 */
const MAX_QUESTIONS_PER_CATEGORY = 50;
const MAX_OPTIONS_PER_QUESTION = 20;

/** Rejects control characters, which have no legitimate place in a label but survive trimming. */
// eslint-disable-next-line no-control-regex -- matching control characters is precisely the intent
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const printable = (value: string): boolean => !CONTROL_CHARS.test(value);

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

const descriptionField = z
  .string()
  .trim()
  .max(500, 'Description must be at most 500 characters')
  .refine(printable, 'Description contains invalid characters');

/**
 * A question in a submitted list. `id` present means "update the stored question with this id";
 * `id` absent means "create a new one". Omitting a stored question from the list removes it.
 */
export const CategoryQuestionSchema = z
  .object({
    id: z.string().uuid('Question id must be a uuid').optional(),
    text: z
      .string()
      .trim()
      .min(1, 'Question text is required')
      .max(300, 'Question text must be at most 300 characters')
      .refine(printable, 'Question text contains invalid characters'),
    // KNOWN TRD DIVERGENCE — do not silently "fix" either way. The signed OSMS TRD (Module 1)
    // describes category questions as yes/no only; we accept five types because `@oses/types`
    // and the built registration form already commit to them. Agreed as deliberate and pending
    // resolution with Cantab — see docs/oses-007-trd-alignment.md §1.
    type: z.enum(['text', 'radio', 'checkbox', 'select', 'file'], {
      errorMap: () => ({ message: 'Type must be one of: text, radio, checkbox, select, file' }),
    }),
    required: z.boolean().optional(),
    options: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'An option cannot be blank')
          .max(100, 'An option must be at most 100 characters')
          .refine(printable, 'An option contains invalid characters'),
      )
      .max(MAX_OPTIONS_PER_QUESTION, `At most ${MAX_OPTIONS_PER_QUESTION} options are allowed`)
      .optional(),
  })
  // Strict here as well as at the top level: without it an unrecognised key would be dropped in
  // silence, so a caller sending e.g. `isActive` on a question would see its request accepted and
  // simply ignored. A 400 naming the field is far easier to act on than a silent no-op.
  .strict()
  .superRefine((question, ctx) => {
    const options = question.options ?? [];
    // Mirrors the DB check constraint. Enforced here too so a mismatch is a readable 400 rather
    // than a constraint violation surfacing as a 500.
    if (questionTypeHasOptions(question.type)) {
      if (options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `A "${question.type}" question needs at least one option`,
        });
      }
    } else if (options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: `A "${question.type}" question cannot have options`,
      });
    }

    if (new Set(options).size !== options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Options must be unique',
      });
    }
  });

const questionsField = z
  .array(CategoryQuestionSchema)
  .max(MAX_QUESTIONS_PER_CATEGORY, `At most ${MAX_QUESTIONS_PER_CATEGORY} questions are allowed`);

export const CreateInstituteCategorySchema = z
  .object({
    code: codeField,
    name: nameField,
    description: descriptionField.optional(),
    questions: questionsField.optional(),
  })
  .strict();
export type CreateInstituteCategoryRequestDto = z.infer<typeof CreateInstituteCategorySchema>;

/**
 * `version` is mandatory: it is the copy the caller loaded, and the update applies only while it
 * still matches. Omitting `questions` leaves the stored question list untouched — sending an
 * empty array is what clears it.
 */
export const UpdateInstituteCategorySchema = z
  .object({
    version: z.number().int().positive('Version must be a positive integer'),
    code: codeField.optional(),
    name: nameField.optional(),
    description: descriptionField.nullable().optional(),
    questions: questionsField.optional(),
  })
  .strict();
export type UpdateInstituteCategoryRequestDto = z.infer<typeof UpdateInstituteCategorySchema>;

/** An explicit target state rather than a blind toggle, so a double submit is idempotent. */
export const UpdateCategoryStatusSchema = z.object({ isActive: z.boolean() }).strict();
export type UpdateCategoryStatusDto = z.infer<typeof UpdateCategoryStatusSchema>;
