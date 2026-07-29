import { z } from 'zod';

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'New password must be at least 8 characters'),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
