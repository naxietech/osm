'use strict';

const path = require('path');

// Absolute tsconfig paths so the `@/*` resolver works no matter the cwd
// (e.g. when lint-staged runs eslint from the monorepo root in pre-commit).
const projects = [
  path.join(__dirname, 'tsconfig.json'),
  path.join(__dirname, 'tsconfig.node.json'),
];

module.exports = {
  extends: ['@oses/eslint-config/react'],
  rules: {
    // Prettier's import-sort plugin owns import ordering (runs last in the commit hook),
    // so disable eslint's competing import/order rule to stop the two fighting.
    'import/order': 'off',
  },
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
