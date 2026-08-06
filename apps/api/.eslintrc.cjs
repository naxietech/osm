'use strict';

// Inherits the monorepo root config; only adds api-specific test overrides.
module.exports = {
  overrides: [
    {
      // Test code legitimately deals with `any` from the test frameworks
      // (supertest's `app.getHttpServer()`, jest mocks). Relax the type-unsafe
      // rules and return-type requirement there — production `src` stays strict.
      files: ['test/**/*.ts', 'src/**/*.spec.ts', 'jest.config.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        // `expect(mock.method).toHaveBeenCalledWith(...)` is the standard jest assertion, and it
        // is a reference to an unbound method by construction. The rule cannot tell that apart
        // from a genuine `this` mistake, so it is a false positive on every typed mock.
        '@typescript-eslint/unbound-method': 'off',
      },
    },
  ],
};
