import type { Role } from '@oses/types';

/** Whether a role needs an institute, may have one, or must not have one. */
export type InstituteRequirement = 'required' | 'optional' | 'none';

/**
 * The Evaluator role. An evaluator is a paper checker, and the domain has two kinds
 * (`packages/types/src/checker.types.ts`): `school-specific`, bound to one institute and
 * allowed to mark only that institute's papers, and `general`, bound to nothing and
 * markable across the board. So an institute is meaningful but not compulsory.
 */
const EVALUATOR_ROLE_ID = 'role_checker';

/**
 * How an institute applies to a role:
 *
 *   required — the role only makes sense inside one institute. Either it is owned by an
 *              institute, or it holds `own-institute` grants, which are meaningless
 *              without one to scope to.
 *   optional — Evaluator: an institute makes them school-specific, leaving it blank makes
 *              them a general evaluator.
 *   none     — a global role (Super Admin, Admin, Controller). Binding one to an institute
 *              is actively harmful: `assertOwnInstitute` on the API treats any caller with
 *              an `instituteId` as institute-bound, so a global user would be silently
 *              locked out of every other institute.
 */
export function instituteRequirementFor(role: Role | undefined): InstituteRequirement {
  if (!role) return 'none';
  if (role.instituteId || role.grants.some((g) => g.scope === 'own-institute')) return 'required';
  if (role.id === EVALUATOR_ROLE_ID) return 'optional';
  return 'none';
}

/** True when the institute picker should be shown at all. */
export function showsInstitutePicker(role: Role | undefined): boolean {
  return instituteRequirementFor(role) !== 'none';
}
