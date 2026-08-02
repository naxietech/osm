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
 * `23503` — a foreign key was violated.
 *
 * Deliberately a neutral detector rather than something that maps straight to a status: the same
 * SQLSTATE means very different things depending on which way the key points. A delete refused
 * because another row still references this one is user-correctable (409); an insert refused
 * because the `created_by` actor does not exist is a bug and must stay a 500. Callers decide,
 * and only where the meaning is unambiguous.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  return hasSqlState(err, '23503');
}
