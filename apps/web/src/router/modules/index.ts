/**
 * Per-module route factories. Each exports a function taking the hosting role's home
 * path plus its slice of ROUTES, so a module shared by several roles is declared once.
 */
export * from './checkers.routes';
export * from './e-sheet.routes';
export * from './exams.routes';
export * from './institute-exams.routes';
export * from './institutes.routes';
export * from './platform.routes';
export * from './rel';
export * from './setup.routes';
export * from './students.routes';
