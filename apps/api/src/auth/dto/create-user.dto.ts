import { z } from 'zod';

import type { CreateUserDto } from '@oses/types';

/**
 * Validator for `POST /users`. The shape itself lives in `@oses/types` as `CreateUserDto`;
 * the `satisfies` below ties this schema to it, so a field added on one side without the
 * other fails the build instead of drifting quietly. Zod stays the source of truth for the
 * *rules* (lengths, formats) — the shared type only fixes which fields exist.
 *
 * This used to be a second, independent declaration of the same body, renamed to dodge the
 * name collision. The two disagreed: the shared one made `password` optional.
 */
export const CreateUserSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  fullName: z.string().min(1, 'Full name is required').max(100),
  roleId: z.string().min(1, 'A role is required'),
  password: z.string().min(8, 'Temporary password must be at least 8 characters'),
  instituteId: z.string().optional(),
}) satisfies z.ZodType<CreateUserDto>;

export type CreateUserRequestDto = z.infer<typeof CreateUserSchema>;
