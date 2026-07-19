'use strict';

module.exports = {
  root: true,
  extends: ['@oses/eslint-config/base'],
  rules: {
    // Prettier's import-sort plugin owns import ordering (runs last in the commit hook),
    // so disable eslint's competing import/order rule to stop the two fighting.
    'import/order': 'off',
  },
};
