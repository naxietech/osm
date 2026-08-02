import {
  CreateSubjectSchema,
  ListSubjectsQuerySchema,
  UpdateSubjectSchema,
  UpdateSubjectStatusSchema,
} from './subject.dto';

describe('Subject DTOs', () => {
  describe('CreateSubjectSchema', () => {
    it('accepts a normal subject and trims the edges', () => {
      expect(CreateSubjectSchema.parse({ code: '  PHY ', name: '  Physics  ' })).toEqual({
        code: 'PHY',
        name: 'Physics',
      });
    });

    it.each([
      ['an empty code', { code: '', name: 'Physics' }],
      ['a code of only spaces', { code: '   ', name: 'Physics' }],
      ['a code over 20 characters', { code: 'A'.repeat(21), name: 'Physics' }],
      ['a code with a space inside', { code: 'PH Y', name: 'Physics' }],
      ['a code with punctuation', { code: 'PHY!', name: 'Physics' }],
      ['an empty name', { code: 'PHY', name: '' }],
      ['a name over 100 characters', { code: 'PHY', name: 'A'.repeat(101) }],
      [
        'a name holding a control character',
        { code: 'PHY', name: `Phy${String.fromCharCode(0)}sics` },
      ],
      [
        'a name holding a DEL character',
        { code: 'PHY', name: `Phy${String.fromCharCode(0x7f)}sics` },
      ],
    ])('rejects %s', (_label, body) => {
      expect(CreateSubjectSchema.safeParse(body).success).toBe(false);
    });

    it('rejects an unknown field instead of dropping it in silence', () => {
      // Without .strict() a caller sending `isActive` here would get a 201 and no effect at all.
      const result = CreateSubjectSchema.safeParse({
        code: 'PHY',
        name: 'Physics',
        isActive: false,
      });
      expect(result.success).toBe(false);
    });

    it('keeps the length limits aligned with the database check constraints', () => {
      expect(CreateSubjectSchema.safeParse({ code: 'A'.repeat(20), name: 'X' }).success).toBe(true);
      expect(CreateSubjectSchema.safeParse({ code: 'A', name: 'X'.repeat(100) }).success).toBe(
        true,
      );
    });
  });

  describe('UpdateSubjectSchema', () => {
    it('accepts just one field', () => {
      expect(UpdateSubjectSchema.parse({ name: 'Physics' })).toEqual({ name: 'Physics' });
      expect(UpdateSubjectSchema.parse({ code: 'PHY' })).toEqual({ code: 'PHY' });
    });

    it('rejects an empty patch — a write that changes nothing is a mistake worth naming', () => {
      expect(UpdateSubjectSchema.safeParse({}).success).toBe(false);
    });

    it('rejects isActive, which belongs on the status route', () => {
      expect(UpdateSubjectSchema.safeParse({ isActive: false }).success).toBe(false);
    });
  });

  describe('UpdateSubjectStatusSchema', () => {
    it('requires a real boolean, not a truthy string', () => {
      expect(UpdateSubjectStatusSchema.parse({ isActive: false })).toEqual({ isActive: false });
      expect(UpdateSubjectStatusSchema.safeParse({ isActive: 'false' }).success).toBe(false);
      expect(UpdateSubjectStatusSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('ListSubjectsQuerySchema', () => {
    it('defaults to every subject when the flag is absent', () => {
      expect(ListSubjectsQuerySchema.parse({})).toEqual({ activeOnly: false });
    });

    it('opts in only on the exact string "true"', () => {
      expect(ListSubjectsQuerySchema.parse({ activeOnly: 'true' })).toEqual({ activeOnly: true });
      expect(ListSubjectsQuerySchema.parse({ activeOnly: 'false' })).toEqual({ activeOnly: false });
    });

    it('rejects a value that JavaScript truthiness would have read as yes', () => {
      // `?activeOnly=1` and `?activeOnly=no` are both non-empty strings; a naive Boolean() would
      // turn each into "active only", including the one that literally says no.
      expect(ListSubjectsQuerySchema.safeParse({ activeOnly: '1' }).success).toBe(false);
      expect(ListSubjectsQuerySchema.safeParse({ activeOnly: 'no' }).success).toBe(false);
    });
  });
});
