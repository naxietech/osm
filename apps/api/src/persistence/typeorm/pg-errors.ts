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
 * Which constraint a `23505` came from.
 *
 * Needed as soon as one table carries more than one unique index: without it every violation on
 * `institutes` reads as the first one the code happens to check, and a duplicate email is
 * reported to the applicant as a duplicate code — a message about a field they got right.
 *
 * Postgres puts the index name in `constraint`; TypeORM keeps it on the wrapped driver error.
 * Returns undefined when the driver did not supply one, so callers must still have a fallback.
 */
export function violatedConstraint(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const candidate = err as { constraint?: unknown; driverError?: { constraint?: unknown } };
  const name = candidate.constraint ?? candidate.driverError?.constraint;
  return typeof name === 'string' ? name : undefined;
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
