import { z } from 'zod';

export const LoginDtoSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  // Login stays lenient (min 6) so it accepts existing/legacy passwords; password *creation*
  // (create-user, reset, change) enforces the stronger min(8). Intentionally asymmetric.
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;
