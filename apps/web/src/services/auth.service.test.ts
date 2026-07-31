import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@oses/types';

import { ApiError } from './api-client';
import { authService } from './auth.service';

const USER = {
  id: 'usr_1',
  email: 'superadmin@oses.pk',
  role: UserRole.SUPER_ADMIN,
  roleId: 'role_super_admin',
  fullName: 'System Administrator',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failure(status: number, message: string): Response {
  return new Response(JSON.stringify({ success: false, error: 'Error', message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

function lastCall(): [string, RequestInit] {
  const call = fetchMock.mock.calls.at(-1);
  return [String(call?.[0]), (call?.[1] ?? {}) as RequestInit];
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authService.login', () => {
  it('posts the credentials and returns the user', async () => {
    fetchMock.mockResolvedValueOnce(envelope(USER));

    await expect(
      authService.login({ email: 'superadmin@oses.pk', password: 'secret123' }),
    ).resolves.toEqual(USER);

    const [url, init] = lastCall();
    expect(url).toContain('/auth/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ email: 'superadmin@oses.pk', password: 'secret123' }));
  });

  it('sends cookies so the API can set the session', async () => {
    fetchMock.mockResolvedValueOnce(envelope(USER));
    await authService.login({ email: 'a@oses.pk', password: 'secret123' });
    expect(lastCall()[1].credentials).toBe('include');
  });

  it('surfaces a rejected sign-in as a 401 ApiError', async () => {
    fetchMock.mockResolvedValueOnce(failure(401, 'Invalid email or password'));
    await expect(
      authService.login({ email: 'a@oses.pk', password: 'wrong' }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' });
  });

  it('surfaces the rate limit as a 429 ApiError', async () => {
    fetchMock.mockResolvedValueOnce(failure(429, 'ThrottlerException: Too Many Requests'));
    const error = await authService
      .login({ email: 'a@oses.pk', password: 'secret123' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
  });
});

describe('authService.me', () => {
  it('returns the signed-in user', async () => {
    fetchMock.mockResolvedValueOnce(envelope(USER));
    await expect(authService.me()).resolves.toEqual(USER);
    expect(lastCall()[0]).toContain('/auth/me');
  });
});

describe('authService.permissions', () => {
  it('returns the grant list', async () => {
    const grants = [{ action: 'dashboard.view', scope: 'all' }];
    fetchMock.mockResolvedValueOnce(envelope(grants));
    await expect(authService.permissions()).resolves.toEqual(grants);
    expect(lastCall()[0]).toContain('/auth/permissions');
  });
});

describe('authService.logout', () => {
  it('posts to the logout endpoint', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ message: 'Logged out' }));
    await authService.logout();
    const [url, init] = lastCall();
    expect(url).toContain('/auth/logout');
    expect(init.method).toBe('POST');
  });
});

describe('authService.changePassword', () => {
  it('posts both passwords', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ message: 'Password changed.' }));
    await authService.changePassword({ currentPassword: 'old12345', newPassword: 'new12345' });

    const [url, init] = lastCall();
    expect(url).toContain('/auth/password/change');
    expect(init.body).toBe(
      JSON.stringify({ currentPassword: 'old12345', newPassword: 'new12345' }),
    );
  });

  it('surfaces a wrong current password as a 400', async () => {
    fetchMock.mockResolvedValueOnce(failure(400, 'Current password is incorrect'));
    await expect(
      authService.changePassword({ currentPassword: 'wrong', newPassword: 'new12345' }),
    ).rejects.toMatchObject({ status: 400, message: 'Current password is incorrect' });
  });
});
