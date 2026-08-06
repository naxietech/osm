/**
 * TypeORM wraps a pg error in a QueryFailedError; the SQLSTATE shows up either directly on the
 * error or on its `driverError`.
 */
function hasSqlState(err: unknown, sqlState: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { code?: unknown; driverError?: { code?: unknown } };
  return candidate.code === sqlState || candidate.driverError?.code === sqlState;
}

/** `23505` — a unique constraint was violated. */
export function isUniqueViolation(err: unknown): boolean {
  return hasSqlState(err, '23505');
}

/**
 * The name of the constraint a violation came from, when the driver reported one.
 *
 * Needed wherever one write can trip more than one unique constraint and they mean different
 * things to the caller — a class save touches `classes.name` and both `class_groups` sibling
 * indexes in the same transaction, and "that class name is taken" is not the same message as
 * "that group name is taken". Returns null when the driver gave no name, so callers must still
 * have a sensible fallback.
 */
export function uniqueViolationConstraint(err: unknown): string | null {
  if (!isUniqueViolation(err)) return null;
  if (typeof err !== 'object' || err === null) return null;
  const candidate = err as { constraint?: unknown; driverError?: { constraint?: unknown } };
  const name = candidate.constraint ?? candidate.driverError?.constraint;
  return typeof name === 'string' ? name : null;
}

/**
 * A foreign key refused the statement.
 *
 * Two SQLSTATEs, because Postgres 18 changed which one it uses: an `ON DELETE RESTRICT` refusal
 * now arrives as `23001` (restrict_violation), where 16 and earlier reported `23503` for that as
 * well as for every other foreign-key failure. Both are accepted — to a caller they mean the same
 * thing, and matching only `23503` on PG18 turns a user-correctable 409 into a 500.
 *
 * Deliberately a neutral detector rather than something that maps straight to a status: the same
 * SQLSTATE means very different things depending on which way the key points. A delete refused
 * because another row still references this one is user-correctable (409); an insert refused
 * because the `created_by` actor does not exist is a bug and must stay a 500. Callers decide,
 * and only where the meaning is unambiguous.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  return hasSqlState(err, '23503') || hasSqlState(err, '23001');
}
