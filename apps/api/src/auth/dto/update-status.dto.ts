import { z } from 'zod';

export const UpdateStatusSchema = z.object({
  // Only the two an admin may set. `pending` and `locked` are system-managed and are not
  // accepted here — an admin reactivates a locked account by setting it back to `active`.
  status: z.enum(['active', 'deactivate']),
});

export type UpdateStatusDto = z.infer<typeof UpdateStatusSchema>;
