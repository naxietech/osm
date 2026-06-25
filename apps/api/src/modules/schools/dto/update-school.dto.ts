import { z } from 'zod';

import { OnboardingStatus } from '@oses/types';

import { CreateSchoolDtoSchema } from './create-school.dto';

export const UpdateSchoolDtoSchema = CreateSchoolDtoSchema.partial().extend({
  onboardingStatus: z.nativeEnum(OnboardingStatus).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSchoolDto = z.infer<typeof UpdateSchoolDtoSchema>;
