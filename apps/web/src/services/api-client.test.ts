import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { API_BASE_URL } from '@/lib/constants';

import { ApiError, apiErrorMessage, apiRequest, onSessionExpired } from './api-client';

/** A successful response in the API's `ApiResponse` envelope. */
function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A failure in the API's error envelope, as HttpExceptionFilter emits it. */
function fail(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Error', message, statusCode: status }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Bare 401 with no renewal attempt possible — used to seed the refresh path. */
const unauthorized = (): Response => fail(401, 'Unauthorized');

let fetchMock: ReturnType<typeof vi.fn>;
const unsubscribers: Array<() => void> = [];

/** Every URL passed to fetch, in order — lets a test count the refresh calls. */
function calledPaths(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]).replace(API_BASE_URL, ''));
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  while (unsubscribers.length) unsubscribers.pop()?.();
  vi.unstubAllGlobals();
});

function trackSessionExpiry(): { count: () => number } {
  let calls = 0;
  unsubscribers.push(
    onSessionExpired(() => {
      calls += 1;
    }),
  );
  return { count: () => calls };
}

describe('apiRequest', () => {
  it('unwraps the envelope and returns only the data', async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: 'u1', email: 'a@oses.pk' }));
    await expect(apiRequest('/auth/me')).resolves.toEqual({ id: 'u1', email: 'a@oses.pk' });
  });

  it('sends cookies on every request', async () => {
    fetchMock.mockResolvedValueOnce(ok(null));
    await apiRequest('/auth/me');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });

  it('sets a JSON content type only when there is a body', async () => {
    fetchMock.mockResolvedValueOnce(ok(null)).mockResolvedValueOnce(ok(null));

    await apiRequest('/auth/me');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: undefined });

    await apiRequest('/auth/login', { method: 'POST', body: { email: 'a@oses.pk' } });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@oses.pk' }),
    });
  });

  it('validates the unwrapped data against a schema', async () => {
    fetchMock.mockResolvedValueOnce(ok({ email: 'a@oses.pk' }));
    const schema = z.object({ email: z.string().email() });
    await expect(apiRequest('/auth/me', { schema })).resolves.toEqual({ email: 'a@oses.pk' });
  });

  it('throws ApiError carrying the status and the server message', async () => {
    fetchMock.mockResolvedValueOnce(fail(409, 'A user with that email already exists'));
    const error = await apiRequest('/users', { method: 'POST' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'A user with that email already exists' });
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>gateway error</html>', { status: 502 }));
    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      status: 502,
      message: 'Request failed (502)',
    });
  });
});

describe('apiErrorMessage', () => {
  it("passes the API's own message through", () => {
    // The API already writes for users; restating those here would only let the two drift.
    expect(apiErrorMessage(new ApiError(401, 'Invalid email or password'))).toBe(
      'Invalid email or password',
    );
    expect(apiErrorMessage(new ApiError(400, 'Current password is incorrect'))).toBe(
      'Current password is incorrect',
    );
    expect(apiErrorMessage(new ApiError(409, 'A user with that email already exists'))).toBe(
      'A user with that email already exists',
    );
  });

  it('replaces the throttler message, which is developer text', () => {
    const message = apiErrorMessage(new ApiError(429, 'ThrottlerException: Too Many Requests'));
    expect(message).not.toContain('ThrottlerException');
    expect(message).toMatch(/too many attempts/i);
  });

  it('replaces server errors, where the API hides internals by design', () => {
    expect(apiErrorMessage(new ApiError(500, 'Internal server error'))).toMatch(/not responding/i);
    expect(apiErrorMessage(new ApiError(502, 'Request failed (502)'))).toMatch(/not responding/i);
  });

  it('supplies a message when the request never reached the server', () => {
    expect(apiErrorMessage(new TypeError('Failed to fetch'))).toMatch(/could not reach/i);
  });
});

describe('apiRequest session renewal', () => {
  it('renews once on a 401 and replays the request', async () => {
    fetchMock
      .mockResolvedValueOnce(unauthorized()) // original
      .mockResolvedValueOnce(ok(null)) // POST /auth/refresh
      .mockResolvedValueOnce(ok({ id: 'u1' })); // replay

    await expect(apiRequest('/auth/me')).resolves.toEqual({ id: 'u1' });
    expect(calledPaths()).toEqual(['/auth/me', '/auth/refresh', '/auth/me']);
  });

  it('renews only once when several requests fail together', async () => {
    // Six requests hit an expired access cookie at the same moment. Six renewals would
    // replay a rotated refresh token, which the API treats as theft and answers by
    // killing the session — so exactly one renewal may go out.
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/auth/refresh')) return Promise.resolve(ok(null));
      return Promise.resolve(
        fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh')).length === 0
          ? unauthorized()
          : ok({ ok: true }),
      );
    });

    await Promise.all(Array.from({ length: 6 }, () => apiRequest('/auth/permissions')));

    expect(calledPaths().filter((p) => p === '/auth/refresh')).toHaveLength(1);
  });

  it('announces the session ended when the renewal is refused', async () => {
    const expiry = trackSessionExpiry();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(fail(401, 'Invalid session'));

    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(expiry.count()).toBe(1);
    expect(calledPaths()).toEqual(['/auth/me', '/auth/refresh']);
  });

  it('announces the session ended when the replay is still refused', async () => {
    // Renewal works but the account was suspended — do not loop, end the session.
    const expiry = trackSessionExpiry();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(fail(401, 'Session no longer valid'));

    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(expiry.count()).toBe(1);
  });

  it('treats a network failure during renewal as the session ending', async () => {
    const expiry = trackSessionExpiry();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(expiry.count()).toBe(1);
  });

  it('does not renew when login is refused — that is a wrong password', async () => {
    const expiry = trackSessionExpiry();
    fetchMock.mockResolvedValueOnce(fail(401, 'Invalid email or password'));

    await expect(
      apiRequest('/auth/login', { method: 'POST', body: { email: 'a@oses.pk' } }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' });

    expect(calledPaths()).toEqual(['/auth/login']);
    expect(expiry.count()).toBe(0);
  });

  it('does not renew when the renewal endpoint itself is refused', async () => {
    fetchMock.mockResolvedValueOnce(fail(401, 'Invalid session'));
    await expect(apiRequest('/auth/refresh', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(calledPaths()).toEqual(['/auth/refresh']);
  });
});
