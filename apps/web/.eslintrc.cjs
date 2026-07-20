'use strict';

const path = require('path');

// Absolute tsconfig paths so the `@/*` resolver works no matter the cwd
// (e.g. when lint-staged runs eslint from the monorepo root in pre-commit).
const projects = [
  path.join(__dirname, 'tsconfig.json'),
  path.join(__dirname, 'tsconfig.node.json'),
];

/**
 * Atomic Design layer boundaries (see README "Import rules").
 *
 * These were documented as "enforced by ESLint" but no rule existed, so the layering
 * held only by convention. Each entry forbids the layers ABOVE it, plus the app
 * (pages/services/router) which no design-system file may reach into — that is what
 * keeps organisms presentational.
 *
 * Matched against the import SPECIFIER, so cross-layer imports written through the
 * `@/` alias are caught. Imports inside one component folder are relative (`./x`) and
 * stay legal, which is intended.
 */
const layerBoundaries = [
  ['atoms', ['molecules', 'organisms', 'templates']],
  ['molecules', ['organisms', 'templates']],
  // Organisms may import atoms and molecules ONLY — including no other organism.
  ['organisms', ['organisms', 'templates']],
  ['templates', []],
];

const APP_ONLY = ['@/pages/*', '@/pages/**', '@/services/*', '@/services/**', '@/router/*'];

const layerOverrides = layerBoundaries.map(([layer, forbidden]) => ({
  files: [`src/design-system/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...forbidden.map((target) => ({
            group: [`@/design-system/${target}`, `@/design-system/${target}/**`],
            message:
              `Files in ${layer}/ must not import from ${target}/. ` +
              'See the Atomic Design import rules in README.md.',
          })),
          {
            group: APP_ONLY,
            message:
              'The design system must stay presentational — take data and callbacks as ' +
              'props instead of importing pages, services or the router.',
          },
        ],
      },
    ],
  },
}));

module.exports = {
  extends: ['@oses/eslint-config/react'],
  rules: {
    // Prettier's import-sort plugin owns import ordering (runs last in the commit hook),
    // so disable eslint's competing import/order rule to stop the two fighting.
    'import/order': 'off',
  },
  overrides: layerOverrides,
  parserOptions: {
    project: projects,
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: projects,
        alwaysTryTypes: true,
      },
      node: true,
    },
  },
};
