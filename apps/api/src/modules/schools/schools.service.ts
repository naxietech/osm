/**
 * REFERENCE PATTERN — SchoolsService
 * Every future service (StudentsService, ExamCyclesService etc.) follows
 * this exact structure:
 * 1. Injectable() decorator
 * 2. Constructor injection of dependencies
 * 3. Methods return typed promises (async with awaited DB calls once connected;
 *    the mock stubs below return resolved promises)
 * 4. NotFoundException thrown for missing resources
 * 5. Stubbed with mock data until database is connected
 * Replace mock data with raw SQL queries via DatabaseService (added in later phase)
 */
import { Injectable, NotFoundException } from '@nestjs/common';

import {
  type CreateSchoolDto,
  InstitutionType,
  OnboardingStatus,
  Province,
  type School,
  SchoolCategory,
  SchoolLevel,
  type SchoolListItem,
  type UpdateSchoolDto,
} from '@oses/types';

const MOCK_SCHOOLS: School[] = [
  {
    id: 'sch_001',
    schoolCode: 'LHR-001',
    schoolName: 'Government High School Gulberg',
    registrationNo: 'FBISE-LHR-2019-001',
    institutionType: InstitutionType.GOVERNMENT,
    schoolLevel: SchoolLevel.HIGHER_SECONDARY,
    category: SchoolCategory.BOYS,
    address: '12 Main Boulevard, Gulberg III',
    city: 'Lahore',
    province: Province.PUNJAB,
    postalCode: '54660',
    contactPersonName: 'Ahmed Raza',
    contactPersonDesignation: 'Principal',
    contactEmail: 'principal@ghsg.edu.pk',
    contactPhone: '+92-42-35761234',
    onboardingStatus: OnboardingStatus.COMPLETE,
    isActive: true,
    createdAt: '2025-01-15T08:00:00.000Z',
    updatedAt: '2025-06-10T12:30:00.000Z',
  },
  {
    id: 'sch_002',
    schoolCode: 'KHI-001',
    schoolName: 'Government Boys Secondary School Clifton',
    registrationNo: 'FBISE-KHI-2020-014',
    institutionType: InstitutionType.GOVERNMENT,
    schoolLevel: SchoolLevel.SECONDARY,
    category: SchoolCategory.BOYS,
    address: 'Block 5, Clifton',
    city: 'Karachi',
    province: Province.SINDH,
    postalCode: '75600',
    contactPersonName: 'Fahad Iqbal',
    contactPersonDesignation: 'Headmaster',
    contactEmail: 'principal@gbssc.edu.pk',
    contactPhone: '+92-21-35871234',
    onboardingStatus: OnboardingStatus.IN_PROGRESS,
    isActive: true,
    createdAt: '2025-02-01T08:00:00.000Z',
    updatedAt: '2025-06-15T09:00:00.000Z',
  },
];

@Injectable()
export class SchoolsService {
  findAll(): Promise<SchoolListItem[]> {
    return Promise.resolve(
      MOCK_SCHOOLS.map(({ id, schoolCode, schoolName, city, onboardingStatus, isActive }) => ({
        id,
        schoolCode,
        schoolName,
        city,
        onboardingStatus,
        isActive,
      })),
    );
  }

  findOne(id: string): Promise<School> {
    if (id === 'not-found') {
      throw new NotFoundException(`School with id "${id}" not found`);
    }

    const school = MOCK_SCHOOLS.find((s) => s.id === id);

    if (!school) {
      throw new NotFoundException(`School with id "${id}" not found`);
    }

    return Promise.resolve(school);
  }

  create(dto: CreateSchoolDto): Promise<School> {
    const now = new Date().toISOString();
    const newSchool: School = {
      id: `sch_${Date.now()}`,
      ...dto,
      onboardingStatus: OnboardingStatus.PENDING,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    return Promise.resolve(newSchool);
  }

  async update(id: string, dto: UpdateSchoolDto): Promise<School> {
    const existing = await this.findOne(id);
    const now = new Date().toISOString();

    return {
      ...existing,
      ...dto,
      updatedAt: now,
    };
  }

  async remove(_id: string): Promise<void> {
    // TODO: soft delete — set isActive = false in database
  }
}
