import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@oses/types';

import { ApiError } from './api-client';
import { USERS_PAGE_SIZE, usersService } from './users.service';

const USER = {
  id: 'usr_1',
  email: 'ayesha@oses.pk',
  role: UserRole.INSTITUTE,
  roleId: 'role_institute',
  fullName: 'Ayesha Khan',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'active' as const,
  lastLoginAt: null,
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

describe('usersService.listUsers', () => {
  it('requests the first page by default and unwraps items + total', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ items: [USER], total: 1 }));

    await expect(usersService.listUsers()).resolves.toEqual({ items: [USER], total: 1 });
    expect(lastCall()[0]).toContain(`/users?limit=${USERS_PAGE_SIZE}&offset=0`);
  });

  it('asks for the requested page', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ items: [], total: 80 }));
    await usersService.listUsers({ offset: 50 });
    expect(lastCall()[0]).toContain('offset=50');
  });

  it('sends cookies — the route needs the users.manage grant', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ items: [], total: 0 }));
    await usersService.listUsers();
    expect(lastCall()[1].credentials).toBe('include');
  });

  it('surfaces a missing grant as a 403', async () => {
    fetchMock.mockResolvedValueOnce(failure(403, 'Insufficient permissions for this action'));
    await expect(usersService.listUsers()).rejects.toMatchObject({ status: 403 });
  });
});

describe('usersService.createUser', () => {
  it('posts the account and its temporary password', async () => {
    fetchMock.mockResolvedValueOnce(envelope(USER));

    await usersService.createUser({
      email: 'new@oses.pk',
      fullName: 'New Person',
      roleId: 'role_institute',
      password: 'temp-pass-1',
      instituteId: 'sch_001',
    });

    const [url, init] = lastCall();
    expect(url).toContain('/users');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'new@oses.pk',
      fullName: 'New Person',
      roleId: 'role_institute',
      password: 'temp-pass-1',
      instituteId: 'sch_001',
    });
  });

  it('surfaces a duplicate email as a 409 with the server wording', async () => {
    fetchMock.mockResolvedValueOnce(failure(409, 'A user with that email already exists'));
    const error = await usersService
      .createUser({
        email: 'taken@oses.pk',
        fullName: 'Someone',
        roleId: 'role_institute',
        password: 'temp-pass-1',
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'A user with that email already exists' });
  });
});

describe('usersService.resetPassword', () => {
  it('posts the new password to that user', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ message: 'Password reset.' }));
    await usersService.resetPassword('usr_1', 'brand-new-1');

    const [url, init] = lastCall();
    expect(url).toContain('/users/usr_1/reset-password');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ password: 'brand-new-1' });
  });
});

describe('usersService.setStatus', () => {
  it('patches the status', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ message: 'Account suspended.' }));
    await usersService.setStatus('usr_1', 'suspended');

    const [url, init] = lastCall();
    expect(url).toContain('/users/usr_1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ status: 'suspended' });
  });

  it('passes the server refusal through — the rule lives on the server', async () => {
    // Suspending yourself, or the last active Super Admin, is refused with a message
    // written for the user. The UI must not restate the rule.
    fetchMock.mockResolvedValueOnce(failure(400, 'Cannot suspend the last active Super Admin.'));
    await expect(usersService.setStatus('usr_1', 'suspended')).rejects.toMatchObject({
      status: 400,
      message: 'Cannot suspend the last active Super Admin.',
    });
  });
});
