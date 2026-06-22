'use strict';

module.exports = {
  extends: ['@oses/eslint-config/react'],
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        alwaysTryTypes: true,
      },
      node: true,
    },
  },
};
