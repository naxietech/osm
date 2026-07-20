/**
 * Multi-client (white-label) tenancy. One deployed app serves multiple clients; the
 * active client decides which modules are enabled and supplies optional brand theming.
 * Resolved at/after login and exposed app-wide (see hooks/use-client).
 *
 * Module gating is AND-ed with RBAC: a module shows only if the client enables it AND
 * the user's role permits it.
 */

/** A gate-able area of the product (nav + routes tag themselves with one of these). */
export type ModuleKey =
  | 'dashboard'
  | 'institutes'
  | 'students'
  | 'exams'
  | 'marking'
  | 'results'
  | 'roles'
  | 'users'
  | 'reference-data'
  | 'e-sheet'
  | 'questions';

/** Optional per-client brand overrides, applied over the base design tokens. */
export interface ClientTheme {
  brand?: string; // solid accent (text-brand, borders, rings)
  brandFrom?: string; // primary-gradient top stop
  brandTo?: string; // primary-gradient bottom stop
}

export interface Client {
  id: string;
  name: string;
  enabledModules: ModuleKey[];
  theme?: ClientTheme;
  /** Reserved extension point for client-specific component overrides (not used yet). */
  customUI?: Record<string, string>;
}
