'use strict';

module.exports = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  // The import sorter parses files with Babel; enable the syntaxes our source
  // actually uses so it can read every file. 'decorators-legacy' is required for
  // NestJS files (@Injectable() etc.) — without it the API files fail to format.
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrder: [
    '^react(.*)$',
    '<THIRD_PARTY_MODULES>',
    '^@oses/(.*)$',
    '^@/(.*)$',
    '^[./]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
