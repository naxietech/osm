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
