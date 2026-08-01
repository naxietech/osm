/**
 * Postgres unique-violation SQLSTATE. TypeORM wraps the pg error in a QueryFailedError; the
 * code shows up either directly on the error or on its `driverError`.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { code?: unknown; driverError?: { code?: unknown } };
  return candidate.code === '23505' || candidate.driverError?.code === '23505';
}
