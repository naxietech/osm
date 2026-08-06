import { z } from 'zod';

import { INSTITUTE_STATUSES, InstitutionType, Province } from '@oses/types';

/**
 * The public registration route accepts these from anyone on the internet, so every field is
 * bounded. An unbounded string on an anonymous endpoint is a free write amplifier — the caps are
 * the blast-radius control, not decoration.
 */
const MAX_ANSWERS = 50;
const MAX_VALUES_PER_ANSWER = 50;

/** Matches the auth module exactly. A different minimum here would be a second, drifting rule. */
const MIN_PASSWORD_LENGTH = 8;

// eslint-disable-next-line no-control-regex -- matching control characters is precisely the intent
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const printable = (value: string): boolean => !CONTROL_CHARS.test(value);

/** Trimmed, bounded, non-blank and free of control characters. */
type BoundedString = z.ZodEffects<z.ZodString, string, string>;

const text = (max: number, label: string): BoundedString =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .refine(printable, `${label} contains invalid characters`);

const optionalText = (max: number, label: string): BoundedString =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .refine(printable, `${label} contains invalid characters`);

/**
 * The government's own code. Letters, digits, dashes and slashes are all seen in real Pakistani
 * institute codes, so the pattern is permissive — its job is to exclude whitespace and control
 * characters, not to guess a format we do not control.
 */
const instituteCodeField = z
  .string()
  .trim()
  .min(1, 'Institute code is required')
  .max(30, 'Institute code must be at most 30 characters')
  .regex(/^[A-Za-z0-9/_-]+$/, 'Institute code may contain only letters, numbers, - / and _');

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(200, 'Email must be at most 200 characters');

const phoneField = z
  .string()
  .trim()
  .min(5, 'Contact number is required')
  .max(30, 'Contact number must be at most 30 characters')
  .regex(/^[0-9+\-()\s]+$/, 'Contact number may contain only digits, spaces and + - ( )');

const answerSchema = z
  .object({
    questionId: z.string().uuid('Question id must be a uuid'),
    values: z
      .array(text(500, 'An answer'))
      .max(MAX_VALUES_PER_ANSWER, `At most ${MAX_VALUES_PER_ANSWER} values per answer`),
  })
  .strict();

/** Everything both entry paths share. Neither can set status, codes, or approval fields. */
const instituteDetails = {
  instituteCode: instituteCodeField,
  instituteName: text(200, 'Institute name'),
  branch: optionalText(150, 'Branch').optional(),
  categoryId: z.string().uuid('Choose a category'),
  institutionType: z.nativeEnum(InstitutionType, {
    errorMap: () => ({
      message: 'Type must be one of: government, semi_government, private, other',
    }),
  }),
  address: text(300, 'Address'),
  city: text(100, 'City'),
  province: z.nativeEnum(Province, {
    errorMap: () => ({ message: 'Choose a valid province' }),
  }),
  postalCode: optionalText(20, 'Postal code').optional(),
  contactPersonName: text(120, 'Contact name'),
  contactPersonDesignation: text(120, 'Designation'),
  contactEmail: emailField,
  contactPhone: phoneField,
  answers: z.array(answerSchema).max(MAX_ANSWERS, `At most ${MAX_ANSWERS} answers`).optional(),
};

/**
 * Public self-registration. The password is collected here because there is no email service to
 * send a temporary one with — it is hashed on arrival and stored apart from the institute row
 * until approval turns it into a login.
 */
export const RegisterInstituteSchema = z
  .object({
    ...instituteDetails,
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(200, 'Password must be at most 200 characters'),
  })
  .strict();
export type RegisterInstituteRequestDto = z.infer<typeof RegisterInstituteSchema>;

/**
 * A super admin entering an institute directly. No password: this row lands `approved`, and its
 * login is created through the Users screen, which already handles temporary passwords properly.
 */
export const CreateInstituteSchema = z.object(instituteDetails).strict();
export type CreateInstituteRequestDto = z.infer<typeof CreateInstituteSchema>;

/**
 * Editing an approved institute. The locked fields — `instituteCode`, `categoryId`, `answers`,
 * `numericCode` — are **absent from this schema**, so `.strict()` answers 400 naming the field
 * rather than accepting the request and silently ignoring it. A caller that cannot tell those
 * apart will believe the change saved.
 */
export const UpdateInstituteSchema = z
  .object({
    instituteName: text(200, 'Institute name').optional(),
    branch: optionalText(150, 'Branch').nullable().optional(),
    institutionType: z.nativeEnum(InstitutionType).optional(),
    address: text(300, 'Address').optional(),
    city: text(100, 'City').optional(),
    province: z.nativeEnum(Province).optional(),
    postalCode: optionalText(20, 'Postal code').nullable().optional(),
    contactPersonName: text(120, 'Contact name').optional(),
    contactPersonDesignation: text(120, 'Designation').optional(),
    contactEmail: emailField.optional(),
    contactPhone: phoneField.optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'Send at least one field to change');
export type UpdateInstituteRequestDto = z.infer<typeof UpdateInstituteSchema>;

/** Answers `{ codeAvailable, emailAvailable }` and nothing else. Both fields optional. */
export const CheckAvailabilitySchema = z
  .object({
    instituteCode: instituteCodeField.optional(),
    contactEmail: emailField.optional(),
  })
  .strict()
  .refine(
    (body) => body.instituteCode !== undefined || body.contactEmail !== undefined,
    'Send an institute code, an email, or both',
  );
export type CheckAvailabilityDto = z.infer<typeof CheckAvailabilitySchema>;

const MAX_PAGE_SIZE = 100;

export const ListInstitutesSchema = z
  .object({
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    q: z.string().trim().min(1).max(100).optional(),
    status: z.enum(INSTITUTE_STATUSES).optional(),
    categoryId: z.string().uuid('categoryId must be a uuid').optional(),
  })
  .strict();
export type ListInstitutesQueryDto = z.infer<typeof ListInstitutesSchema>;

/**
 * Approve & Register. `createLogin` defaults to true because that is the whole point of the
 * single button — approving without provisioning access is the double journey this flow exists
 * to avoid, but it stays possible for an institute whose accounts are managed separately.
 *
 * `password` is only needed when there is no stored credential — an institute a super admin
 * entered directly, or one whose application predates the password field.
 */
export const ApproveInstituteSchema = z
  .object({
    createLogin: z.boolean().default(true),
    fullName: text(120, 'Full name').optional(),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(200, 'Password must be at most 200 characters')
      .optional(),
  })
  .strict();
export type ApproveInstituteDto = z.infer<typeof ApproveInstituteSchema>;

/** A reason is mandatory: without one nobody can tell the institute what to fix. */
export const RejectInstituteSchema = z.object({ reason: text(500, 'Reason') }).strict();
export type RejectInstituteDto = z.infer<typeof RejectInstituteSchema>;

/**
 * An explicit target state rather than a blind toggle, so a double submit is idempotent.
 * `rejected` is absent on purpose — it is reachable only from `pending`, through its own route.
 */
export const UpdateInstituteStatusSchema = z
  .object({ status: z.enum(['approved', 'deactivated']) })
  .strict();
export type UpdateInstituteStatusDto = z.infer<typeof UpdateInstituteStatusSchema>;
