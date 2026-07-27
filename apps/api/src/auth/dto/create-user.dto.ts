import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  fullName: z.string().min(1, 'Full name is required').max(100),
  roleId: z.string().min(1, 'A role is required'),
  password: z.string().min(8, 'Temporary password must be at least 8 characters'),
  instituteId: z.string().optional(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
