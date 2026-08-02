export const APP_NAME = 'OSES';
export const APP_FULL_NAME = 'On-Screen Exam System';

/**
 * Where the API lives. `apps/web/.env` is git-ignored, so a fresh clone, a CI runner and
 * the test suite all start without a value for it.
 *
 * Without a fallback that produced the literal string `undefined` as the base, so every
 * request went to `undefined/auth/me` — which the browser resolves against the dev server,
 * not the API. The dev server answers 404, and a 404 is not a 401, so the app reported
 * "Request failed (404)" on the login form and "we couldn't reach the server" instead of
 * signing anyone out. One missing file, four different-looking bugs.
 *
 * Development falls back to the address in `.env.example`. Production deliberately does
 * not: a build shipped without its API address is broken, and failing here — loudly, once,
 * at startup — is better than a working-looking app whose every request 404s.
 */
const configuredApiBaseUrl = import.meta.env['VITE_API_BASE_URL'] as string | undefined;
const DEV_API_BASE_URL = 'http://localhost:3001/api/v1';

if (!configuredApiBaseUrl && import.meta.env.PROD) {
  throw new Error(
    'VITE_API_BASE_URL is not set. It must be provided at build time — the app has no API address to call.',
  );
}

export const API_BASE_URL = configuredApiBaseUrl ?? DEV_API_BASE_URL;

/**
 * Shortest password the API will accept, mirrored here so a form can fail before the round
 * trip. It is declared once: three copies of `8` is how one of them ends up saying 8 while
 * the API has moved to 12. The wording of any *rejection* still comes from the API.
 */
export const MIN_PASSWORD_LENGTH = 8;

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const SUPPORTED_SCAN_FORMATS = ['image/tiff', 'application/pdf'] as const;
