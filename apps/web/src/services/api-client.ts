/**
 * HTTP client for the OSES API — the one place every real request goes through.
 *
 * Auth is cookie-based: the API sets HttpOnly access + refresh cookies that JavaScript
 * cannot read, so there is no token to attach. We only have to ask the browser to send
 * the cookies (`credentials: 'include'`).
 *
 * Responsibilities, all here so no caller has to repeat them:
 *   - send cookies, and JSON headers only when there is a body
 *   - unwrap the `ApiResponse` envelope and hand back just `data`
 *   - turn the API's error envelope into an `ApiError` carrying the status code
 *   - on 401, renew the session once and replay the request
 *
 * Only the auth module is wired to this today; every other service is still a mock.
 */
import type { z } from 'zod';

import type { ApiResponse } from '@oses/types';

import { API_BASE_URL } from '@/lib/constants';

import { API_ENDPOINTS } from './api-endpoints';

export class ApiError extends Error {
  readonly status: number;

  /**
   * The API's `error` field — usually the exception class name, but a route may send its own
   * code when one status covers two different failures. The categories screen uses it to tell
   * an optimistic-lock 409 (reload and try again) from a 409 refusing the submission itself
   * (reloading changes nothing). Matching on the message text instead would break the moment
   * the API rephrased it, which is exactly the coupling `apiErrorMessage` exists to avoid.
   */
  readonly code: string | undefined;

  /**
   * True when `message` is the API's own wording and fit to show a user; false when we
   * had to invent it because the response carried nothing readable. Without this flag the
   * two are indistinguishable, and a synthesised `Request failed (404)` reaches the screen
   * looking exactly like a real message from the server.
   */
  readonly fromServer: boolean;

  constructor(status: number, message: string, fromServer = false, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fromServer = fromServer;
    this.code = code;
  }
}

/**
 * The message to show a user for a failed request.
 *
 * The API's own message is used wherever it has one worth showing — it already writes for
 * users ("Invalid email or password", "Current password is incorrect", "A user with that
 * email already exists"), and restating those here would only let the two drift. We supply
 * text only where the API gives us nothing usable:
 *
 *   429 — the throttler's message is "ThrottlerException: Too Many Requests"
 *   5xx — the API hides internals by design, and a proxy failure has no JSON body at all
 *   no readable body — nothing answered in our envelope, so `message` is one we made up
 *   no response — the request never reached the server, so there is no message to use
 *
 * That fourth case is the one that used to leak: a 404 from a proxy or a misconfigured base
 * URL has no JSON body, so the fallback string `Request failed (404)` was shown verbatim on
 * the login form. A status code is not something a user can act on.
 *
 * Anything policy-specific (lockout thresholds, password rules) belongs in the API's
 * message, not here: duplicating a backend constant in UI copy is how the copy goes stale.
 */
export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (error.status >= 500) return 'The server is not responding. Please try again shortly.';
  if (error.fromServer) return error.message;
  if (error.status === 404) {
    return 'That service could not be found. Please try again, or contact support if it keeps happening.';
  }
  return 'Something went wrong handling that request. Please try again.';
}

// ---- session-expired notification ----

type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Subscribe to "the session is over and could not be renewed". The client cannot
 * navigate on its own — service files are barred from importing `@/router` — so it
 * announces instead and the auth provider does the navigating. Returns an unsubscribe.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener();
}

// ---- session renewal ----

/**
 * Paths that must never trigger a renewal. A 401 from login means "wrong password",
 * and a 401 from refresh means the session is genuinely dead — retrying either would
 * be pointless, and retrying refresh would recurse.
 *
 * The `/public/*` routes are here for a different reason: they take no credentials at all, so
 * a 401 from one is a bug in the request rather than an expired session. Trying to renew would
 * fire a pointless refresh for a visitor who has never signed in — on the registration link,
 * which is the one page most of its callers will ever see.
 */
const NO_RENEWAL_PATHS: string[] = [
  API_ENDPOINTS.auth.login,
  API_ENDPOINTS.auth.refresh,
  '/public/',
];

/**
 * The renewal currently in the air, or null. Requests tend to fail in bursts — a
 * dashboard fires several at once and they all come back 401 together. If each started
 * its own renewal the first would rotate the refresh cookie and the rest would present
 * the retired one, which the API reads as a stolen token and answers by killing the
 * whole session. So the first 401 starts one renewal and the others wait on it.
 */
let renewalInFlight: Promise<boolean> | null = null;

function renewSession(): Promise<boolean> {
  renewalInFlight ??= fetch(`${API_BASE_URL}${API_ENDPOINTS.auth.refresh}`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch((error: unknown) => {
      // Offline / DNS / CORS. Indistinguishable from a dead session in the return value,
      // so log it — otherwise a forced sign-out caused by one dropped packet looks exactly
      // like a real expiry and there is no way to tell them apart afterwards.
      // eslint-disable-next-line no-console -- the two causes are otherwise identical
      console.warn('Session renewal could not reach the server; treating as expired', error);
      return false;
    })
    .finally(() => {
      renewalInFlight = null;
    });
  return renewalInFlight;
}

// ---- requests ----

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Optional zod schema to validate + narrow the unwrapped `data`. */
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
}

function send(path: string, options: RequestOptions<unknown>): Promise<Response> {
  const { method = 'GET', body, signal } = options;
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    signal,
    credentials: 'include',
    // Only on requests that carry one — a bare GET with no custom header skips the
    // CORS preflight entirely.
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  let res = await send(path, options);

  if (res.status === 401 && !NO_RENEWAL_PATHS.some((p) => path.startsWith(p))) {
    if (await renewSession()) {
      res = await send(path, options);
      // Still refused straight after a successful renewal — the account is deactivated or
      // gone. Treat that as the session ending rather than looping.
      if (res.status === 401) notifySessionExpired();
    } else {
      notifySessionExpired();
    }
  }

  if (!res.ok) throw await toApiError(res);

  return unwrap<T>(res, options.schema);
}

async function unwrap<T>(res: Response, schema?: z.ZodType<T>): Promise<T> {
  if (res.status === 204) return undefined as T;

  // `error` is on the failure envelope (`ApiError` in @oses/types), not the success one — this
  // path exists precisely for a body that claims success:false, so read it here rather than
  // widening the shared success type with a field it never carries.
  let envelope: ApiResponse<unknown> & { error?: string };
  try {
    envelope = (await res.json()) as ApiResponse<unknown> & { error?: string };
  } catch (error) {
    // Keep the parse failure discoverable: if the envelope shape ever drifts, the user's
    // message alone gives nobody a way to find out why.
    // eslint-disable-next-line no-console -- root cause is otherwise unrecoverable
    console.error('Could not parse the API response body', { status: res.status, error });
    throw new ApiError(res.status, 'The server returned an unreadable response.');
  }

  // A 2xx carrying `success: false`. Rare, but it happens when something answers in our
  // envelope shape without going through the interceptor. Left unchecked, `data` is
  // undefined and the caller renders it as a successful empty result — a signed-in user
  // shows as signed-out, a list shows as empty, and nothing anywhere records why.
  if (!envelope.success) {
    throw new ApiError(
      res.status,
      envelope.message ?? 'The server rejected the request.',
      envelope.message !== undefined,
      envelope.error,
    );
  }

  return schema ? schema.parse(envelope.data) : (envelope.data as T);
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    if (body.message) return new ApiError(res.status, body.message, true, body.error);
  } catch {
    /* no JSON body — fall through to the synthesised message */
  }
  // Marked as not-from-server, so `apiErrorMessage` swaps it for something a user can read.
  return new ApiError(res.status, `Request failed (${res.status})`);
}
