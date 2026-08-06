import { z } from 'zod';

/**
 * Admin edit of an existing account. Every field is optional — omitting one leaves it alone.
 *
 * `password` is deliberately absent: resetting a password is its own endpoint, because it also
 * revokes sessions and clears any lockout. Status is likewise its own endpoint.
 *
 * `roleId` and `instituteId` are validated as a pair in the service, not here — the rule depends
 * on the account's current state, which a schema cannot see (see `UsersService.resolveInstituteId`).
 */
export const UpdateUserSchema = z
  .object({
    email: z.string().trim().email('Must be a valid email address').optional(),
    fullName: z.string().trim().min(1, 'Full name is required').max(100).optional(),
    roleId: z.string().uuid('Role id must be a uuid').optional(),
    instituteId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((dto) => Object.keys(dto).length > 0, { message: 'Nothing to update' });

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
