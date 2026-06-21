export enum OnboardingStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  SUSPENDED = 'suspended',
}

export interface School {
  id: string;
  schoolCode: string;
  schoolName: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  onboardingStatus: OnboardingStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Used in list views — omits heavy/unused fields
export interface SchoolListItem {
  id: string;
  schoolCode: string;
  schoolName: string;
  city: string;
  onboardingStatus: OnboardingStatus;
  isActive: boolean;
}

export interface CreateSchoolDto {
  schoolCode: string;
  schoolName: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
}

export interface UpdateSchoolDto {
  schoolName?: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  onboardingStatus?: OnboardingStatus;
}
