/**
 * The database this suite is allowed to destroy.
 *
 * Every e2e spec empties tables before it runs — it has to, or yesterday's leftovers decide
 * today's results. That makes "which database" a safety question, not a configuration detail.
 *
 * This used to read `DATABASE_URL_TEST ?? DATABASE_URL`, and the fallback was the bug. It looked
 * helpful ("work even if you haven't set up a test database") but it gave a destructive operation
 * a convenient default: with `DATABASE_URL_TEST` unset, `pnpm test:e2e` truncated the *dev*
 * database. Worse, the specs then skipped themselves when they could not find a URL, so the suite
 * reported a green tick while five of eight files never ran.
 *
 * Both failures came from choosing "carry on quietly" over "stop and say something". This does
 * the opposite: no fallback, no skipping, and a message that says exactly what to fix.
 */

/** Refuses anything that is not obviously a throwaway database. */
const TEST_DATABASE_NAME = /_test$/;

const HOW_TO_FIX = `
Add this to apps/api/.env:

  DATABASE_URL_TEST=postgres://oses:oses_dev_pw@localhost:5433/oses_test

The e2e suite empties tables before every run, so it needs a database of its own. Pointing it at
your development database would delete the data you are working with.
`;

/**
 * The URL the e2e suite may use, or a thrown error explaining what to set.
 *
 * Throwing at module scope is deliberate: jest reports it as a failed suite, which is loud.
 * Returning null and skipping would reproduce exactly the silence this replaces.
 */
export function requireTestDatabaseUrl(): string {
  const url = process.env['DATABASE_URL_TEST'];
  if (!url) {
    throw new Error(
      `DATABASE_URL_TEST is not set — refusing to run destructive tests.${HOW_TO_FIX}`,
    );
  }

  const name = databaseNameOf(url);
  if (!TEST_DATABASE_NAME.test(name)) {
    // The second guard, and the one that matters most. "Must be set" stops the accident; "must
    // look like a test database" stops someone setting it to the dev URL to make the first
    // message go away — which would be the original bug, reintroduced deliberately.
    throw new Error(
      `DATABASE_URL_TEST points at "${name}", which is not a test database — refusing to run ` +
        `destructive tests against it. The name must end in "_test".${HOW_TO_FIX}`,
    );
  }

  return url;
}

function databaseNameOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error(`DATABASE_URL_TEST is not a valid URL: "${url}"${HOW_TO_FIX}`);
  }
}
