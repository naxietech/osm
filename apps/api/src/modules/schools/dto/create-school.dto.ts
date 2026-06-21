import { z } from 'zod';

export const CreateSchoolDtoSchema = z.object({
  schoolCode: z.string().min(2).max(20),
  schoolName: z.string().min(2).max(255),
  city: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7).max(30),
});

export type CreateSchoolDto = z.infer<typeof CreateSchoolDtoSchema>;
