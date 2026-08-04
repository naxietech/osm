import { CreateClassSchema, UpdateClassSchema } from './class.dto';

const GROUP_ID = '11111111-1111-4111-8111-111111111111';

/** The first message Zod reports, for asserting on *why* something was refused. */
function refusal(result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}): string {
  return result.error?.issues[0]?.message ?? '';
}

describe('CreateClassSchema', () => {
  it('accepts a class with no groups at all — Class 1–8 have none', () => {
    const result = CreateClassSchema.safeParse({ name: 'Class 3', ordinal: 3 });

    expect(result.success).toBe(true);
  });

  it('defaults an omitted subgroups list to empty', () => {
    const result = CreateClassSchema.safeParse({
      name: 'Class 9',
      ordinal: 9,
      groups: [{ name: 'Science' }],
    });

    expect(result.success && result.data.groups?.[0]?.subgroups).toEqual([]);
  });

  it('trims names, so a padded value cannot pass the length check', () => {
    const result = CreateClassSchema.safeParse({ name: '  Class 9  ', ordinal: 9 });

    expect(result.success && result.data.name).toBe('Class 9');
  });

  it('refuses a name of only whitespace', () => {
    expect(CreateClassSchema.safeParse({ name: '   ', ordinal: 9 }).success).toBe(false);
  });

  it('refuses a control character buried in a name, which trimming does not remove', () => {
    // U+0001 is not whitespace, so trimming leaves it alone and the minimum length is
    // satisfied. Only the printable check catches it — the name would render as "Class9"
    // with an invisible byte making two visually identical classes distinct rows.
    const name = `Class${String.fromCharCode(1)}9`;

    const result = CreateClassSchema.safeParse({ name, ordinal: 9 });

    expect(refusal(result)).toBe('Class name contains invalid characters');
  });

  it('refuses a group id — nothing exists yet for one to refer to', () => {
    const result = CreateClassSchema.safeParse({
      name: 'Class 9',
      ordinal: 9,
      groups: [{ id: GROUP_ID, name: 'Science' }],
    });

    // Refused rather than dropped: a silently ignored id looks like a successful save.
    expect(result.success).toBe(false);
  });

  it('refuses an unrecognised top-level field instead of dropping it', () => {
    const result = CreateClassSchema.safeParse({ name: 'Class 9', ordinal: 9, isActive: true });

    expect(result.success).toBe(false);
  });

  describe('ordinal', () => {
    it.each([
      ['zero', 0],
      ['a hundred', 100],
      ['a fraction', 9.5],
    ])('refuses %s', (_label, ordinal) => {
      expect(CreateClassSchema.safeParse({ name: 'Class 9', ordinal }).success).toBe(false);
    });

    it('is required — the database column is NOT NULL and only the admin knows the order', () => {
      expect(CreateClassSchema.safeParse({ name: 'Class 9' }).success).toBe(false);
    });
  });

  describe('sibling names', () => {
    it('refuses two groups sharing a name', () => {
      const result = CreateClassSchema.safeParse({
        name: 'Class 9',
        ordinal: 9,
        groups: [{ name: 'Science' }, { name: 'Science' }],
      });

      expect(refusal(result)).toBe('Two groups in one class cannot share a name');
    });

    it('refuses two groups differing only in case, because the column is citext', () => {
      const result = CreateClassSchema.safeParse({
        name: 'Class 9',
        ordinal: 9,
        groups: [{ name: 'Science' }, { name: 'science' }],
      });

      expect(result.success).toBe(false);
    });

    it('refuses two subgroups sharing a name under one group', () => {
      const result = CreateClassSchema.safeParse({
        name: 'Class 9',
        ordinal: 9,
        groups: [{ name: 'Science', subgroups: [{ name: 'Biology' }, { name: 'Biology' }] }],
      });

      expect(refusal(result)).toBe('Two subgroups under one group cannot share a name');
    });

    it('allows the same subgroup name under two different groups', () => {
      const result = CreateClassSchema.safeParse({
        name: 'Class 9',
        ordinal: 9,
        groups: [
          { name: 'Science', subgroups: [{ name: 'Statistics' }] },
          { name: 'Commerce', subgroups: [{ name: 'Statistics' }] },
        ],
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('UpdateClassSchema', () => {
  it('requires the version the caller loaded', () => {
    expect(UpdateClassSchema.safeParse({ name: 'Class 9' }).success).toBe(false);
  });

  it('accepts group ids, unlike create', () => {
    const result = UpdateClassSchema.safeParse({
      version: 1,
      groups: [{ id: GROUP_ID, name: 'Science' }],
    });

    expect(result.success).toBe(true);
  });

  it('refuses a group id that is not a uuid', () => {
    const result = UpdateClassSchema.safeParse({
      version: 1,
      groups: [{ id: 'grp_science', name: 'Science' }],
    });

    expect(result.success).toBe(false);
  });

  it('distinguishes an omitted tree from an empty one', () => {
    const omitted = UpdateClassSchema.safeParse({ version: 1, name: 'Class 9' });
    const cleared = UpdateClassSchema.safeParse({ version: 1, groups: [] });

    // Omitted means "leave the tree alone"; empty means "deactivate all of it". A default here
    // would collapse the two and quietly dismantle a class on any rename.
    expect(omitted.success && omitted.data.groups).toBeUndefined();
    expect(cleared.success && cleared.data.groups).toEqual([]);
  });

  it('allows a null description, so it can be cleared', () => {
    expect(UpdateClassSchema.safeParse({ version: 1, description: null }).success).toBe(true);
  });
});
