export enum OnboardingStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  SUSPENDED = 'suspended',
}

/** Education level the institution offers, mapped to Pakistani board stages. */
export enum SchoolLevel {
  SECONDARY = 'secondary', // SSC / Matric (Grades 9–10)
  HIGHER_SECONDARY = 'higher_secondary', // HSSC / Intermediate (Grades 11–12)
  BOTH = 'both',
}

/** Ownership / sector of the institution. */
export enum InstitutionType {
  GOVERNMENT = 'government',
  PRIVATE = 'private',
  FEDERAL = 'federal',
  OTHER = 'other',
}

/** Student gender category of the institution. */
export enum SchoolCategory {
  BOYS = 'boys',
  GIRLS = 'girls',
  CO_EDUCATION = 'co_education',
}

/** Pakistani provinces and administrative regions. */
export enum Province {
  PUNJAB = 'punjab',
  SINDH = 'sindh',
  KPK = 'kpk', // Khyber Pakhtunkhwa
  BALOCHISTAN = 'balochistan',
  ICT = 'ict', // Islamabad Capital Territory
  AJK = 'ajk', // Azad Jammu & Kashmir
  GB = 'gb', // Gilgit-Baltistan
}

export interface School {
  id: string;
  schoolCode: string;
  schoolName: string;
  registrationNo: string;
  institutionType: InstitutionType;
  schoolLevel: SchoolLevel;
  category: SchoolCategory;
  address: string;
  city: string;
  province: Province;
  postalCode?: string;
  contactPersonName: string;
  contactPersonDesignation: string;
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
  registrationNo: string;
  institutionType: InstitutionType;
  schoolLevel: SchoolLevel;
  category: SchoolCategory;
  address: string;
  city: string;
  province: Province;
  postalCode?: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
}

export interface UpdateSchoolDto {
  schoolName?: string;
  registrationNo?: string;
  institutionType?: InstitutionType;
  schoolLevel?: SchoolLevel;
  category?: SchoolCategory;
  address?: string;
  city?: string;
  province?: Province;
  postalCode?: string;
  contactPersonName?: string;
  contactPersonDesignation?: string;
  contactEmail?: string;
  contactPhone?: string;
  onboardingStatus?: OnboardingStatus;
  isActive?: boolean;
}
