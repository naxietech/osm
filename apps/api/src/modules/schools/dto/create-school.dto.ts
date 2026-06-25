import { z } from 'zod';

import { InstitutionType, Province, SchoolCategory, SchoolLevel } from '@oses/types';

export const CreateSchoolDtoSchema = z.object({
  schoolCode: z.string().min(2).max(20),
  schoolName: z.string().min(2).max(255),
  registrationNo: z.string().min(2).max(50),
  institutionType: z.nativeEnum(InstitutionType),
  schoolLevel: z.nativeEnum(SchoolLevel),
  category: z.nativeEnum(SchoolCategory),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  province: z.nativeEnum(Province),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, 'Postal code must be 5 digits')
    .optional(),
  contactPersonName: z.string().min(2).max(150),
  contactPersonDesignation: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7).max(30),
});

export type CreateSchoolDto = z.infer<typeof CreateSchoolDtoSchema>;
