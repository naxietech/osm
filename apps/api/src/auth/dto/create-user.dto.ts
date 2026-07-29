import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  fullName: z.string().min(1, 'Full name is required').max(100),
  roleId: z.string().min(1, 'A role is required'),
  password: z.string().min(8, 'Temporary password must be at least 8 characters'),
  instituteId: z.string().optional(),
});

// Named to avoid colliding with @oses/types' own `CreateUserDto` (which has an optional
// password); this API DTO requires a temporary password.
export type CreateUserRequestDto = z.infer<typeof CreateUserSchema>;
