import { InstitutionType, Province } from '@oses/types';

import {
  CheckAvailabilitySchema,
  RegisterInstituteSchema,
  UpdateInstituteSchema,
} from './institute.dto';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

const VALID_REGISTRATION = {
  instituteCode: 'S01',
  instituteName: 'Government High School',
  categoryId: CATEGORY_ID,
  institutionType: InstitutionType.GOVERNMENT,
  address: '1 Mall Road',
  city: 'Lahore',
  province: Province.PUNJAB,
  contactPersonName: 'Ayesha Khan',
  contactPersonDesignation: 'Principal',
  contactEmail: 'principal@example.pk',
  contactPhone: '+92-42-1234567',
  password: 'a-strong-password',
};

/** The first error message, or null when the payload was accepted. */
function errorOf(result: { success: boolean; error?: { issues: Array<{ message: string }> } }) {
  return result.success ? null : (result.error?.issues[0]?.message ?? 'rejected');
}

describe('RegisterInstituteSchema', () => {
  it('accepts a complete registration', () => {
    expect(RegisterInstituteSchema.safeParse(VALID_REGISTRATION).success).toBe(true);
  });

  it('lowercases the contact email so a duplicate cannot hide behind capitals', () => {
    const parsed = RegisterInstituteSchema.parse({
      ...VALID_REGISTRATION,
      contactEmail: 'Principal@Example.PK',
    });
    expect(parsed.contactEmail).toBe('principal@example.pk');
  });

  it('requires a password of at least 8 characters, matching the auth module', () => {
    const result = RegisterInstituteSchema.safeParse({ ...VALID_REGISTRATION, password: 'short' });
    expect(errorOf(result)).toMatch(/at least 8 characters/);
  });

  it('rejects an unknown field rather than dropping it in silence', () => {
    const result = RegisterInstituteSchema.safeParse({ ...VALID_REGISTRATION, status: 'approved' });
    expect(result.success).toBe(false);
  });

  it('rejects an institute code containing whitespace', () => {
    const result = RegisterInstituteSchema.safeParse({
      ...VALID_REGISTRATION,
      instituteCode: 'S 01',
    });
    expect(errorOf(result)).toMatch(/only letters, numbers/);
  });

  it('accepts the slashes real government codes contain', () => {
    const result = RegisterInstituteSchema.safeParse({
      ...VALID_REGISTRATION,
      instituteCode: 'PB/LHR-001',
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdateInstituteSchema — the locked fields', () => {
  // These four are locked after approval. They are absent from the schema, so `.strict()` answers
  // 400 naming the field. Accepting and ignoring them would leave the caller believing it saved.
  it.each([
    ['instituteCode', { instituteCode: 'S02' }],
    ['categoryId', { categoryId: CATEGORY_ID }],
    ['answers', { answers: [] }],
    ['numericCode', { numericCode: 7 }],
    ['status', { status: 'approved' }],
  ])('refuses to change %s', (_label, patch) => {
    expect(UpdateInstituteSchema.safeParse(patch).success).toBe(false);
  });

  it('accepts the fields that stay editable', () => {
    const result = UpdateInstituteSchema.safeParse({
      instituteName: 'Government High School, Model Town',
      city: 'Karachi',
      contactEmail: 'new-principal@example.pk',
    });
    expect(result.success).toBe(true);
  });

  it('allows the contact email to change — contact people move on', () => {
    expect(UpdateInstituteSchema.safeParse({ contactEmail: 'next@example.pk' }).success).toBe(true);
  });

  it('allows branch and postal code to be cleared with null', () => {
    expect(UpdateInstituteSchema.safeParse({ branch: null, postalCode: null }).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    const result = UpdateInstituteSchema.safeParse({});
    expect(errorOf(result)).toMatch(/at least one field/i);
  });
});

describe('CheckAvailabilitySchema', () => {
  it('accepts either field on its own', () => {
    expect(CheckAvailabilitySchema.safeParse({ instituteCode: 'S01' }).success).toBe(true);
    expect(CheckAvailabilitySchema.safeParse({ contactEmail: 'a@b.pk' }).success).toBe(true);
  });

  it('rejects an empty body, which would be a pointless round trip', () => {
    const result = CheckAvailabilitySchema.safeParse({});
    expect(errorOf(result)).toMatch(/institute code, an email, or both/i);
  });
});
