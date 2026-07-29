import { z } from 'zod';

export const UpdateStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

export type UpdateStatusDto = z.infer<typeof UpdateStatusSchema>;
