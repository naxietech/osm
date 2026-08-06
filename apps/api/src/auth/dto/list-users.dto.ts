import { z } from 'zod';

import { USER_STATUSES } from '../ports';

export const ListUsersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  /**
   * Free-text filter over email and full name. Capped so a caller cannot push an enormous
   * pattern into a LIKE; an empty or blank value is treated as "no filter" rather than as a
   * search for nothing.
   */
  q: z
    .string()
    .trim()
    .max(100, 'Search text must be at most 100 characters')
    .optional()
    .transform((value) => (value ? value : undefined)),
  /**
   * Exact-match narrowing. Kept separate from `q` on purpose: these are picked from a fixed set,
   * match exactly, and use an index — folding them into the free-text box would make a cheap
   * query behave like an expensive one.
   */
  status: z.enum(USER_STATUSES).optional(),
  roleId: z.string().uuid('Role id must be a uuid').optional(),
});

export type ListUsersQuery = z.infer<typeof ListUsersSchema>;
