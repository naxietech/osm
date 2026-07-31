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

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * The message to show a user for a failed request.
 *
 * The API's own message is used wherever it has one worth showing — it already writes for
 * users ("Invalid email or password", "Current password is incorrect", "A user with that
 * email already exists"), and restating those here would only let the two drift. We supply
 * text in exactly the three cases where the API gives us nothing usable:
 *
 *   429 — the throttler's message is "ThrottlerException: Too Many Requests"
 *   5xx — the API hides internals by design, and a proxy failure has no JSON body at all
 *   no response — the request never reached the server, so there is no message to use
 *
 * Anything policy-specific (lockout thresholds, password rules) belongs in the API's
 * message, not here: duplicating a backend constant in UI copy is how the copy goes stale.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (error.status >= 500) return 'The server is not responding. Please try again shortly.';
    return error.message;
  }
  return 'Could not reach the server. Check your connection and try again.';
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
 */
const NO_RENEWAL_PATHS: string[] = [API_ENDPOINTS.auth.login, API_ENDPOINTS.auth.refresh];

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
      // Still refused straight after a successful renewal — the account is suspended or
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

  let envelope: ApiResponse<unknown>;
  try {
    envelope = (await res.json()) as ApiResponse<unknown>;
  } catch (error) {
    // Keep the parse failure discoverable: if the envelope shape ever drifts, the user's
    // message alone gives nobody a way to find out why.
    // eslint-disable-next-line no-console -- root cause is otherwise unrecoverable
    console.error('Could not parse the API response body', { status: res.status, error });
    throw new ApiError(res.status, 'The server returned an unreadable response.');
  }

  return schema ? schema.parse(envelope.data) : (envelope.data as T);
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    /* no JSON body — keep the generic message */
  }
  return new ApiError(res.status, message);
}
