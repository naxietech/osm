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
    fetchMock.mockResolvedValueOnce(envelope({ message: 'Account deactivated.' }));
    await usersService.setStatus('usr_1', 'deactivate');

    const [url, init] = lastCall();
    expect(url).toContain('/users/usr_1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ status: 'deactivate' });
  });

  it('passes the server refusal through — the rule lives on the server', async () => {
    // Deactivating yourself, or the last active Super Admin, is refused with a message
    // written for the user. The UI must not restate the rule.
    fetchMock.mockResolvedValueOnce(failure(400, 'Cannot deactivate the last active Super Admin.'));
    await expect(usersService.setStatus('usr_1', 'deactivate')).rejects.toMatchObject({
      status: 400,
      message: 'Cannot deactivate the last active Super Admin.',
    });
  });
});

describe('usersService.listUsers filters', () => {
  /** The query string of the last request. */
  function query(): URLSearchParams {
    const [url] = lastCall();
    return new URLSearchParams(url.slice(url.indexOf('?')));
  }

  it('always sends a page window', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ items: [], total: 0 }));
    await usersService.listUsers();

    expect(query().get('limit')).toBe(String(USERS_PAGE_SIZE));
    expect(query().get('offset')).toBe('0');
  });

  it('sends search, status and role together', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ items: [], total: 0 }));
    await usersService.listUsers({ q: 'khan', status: 'locked', roleId: 'role_institute' });

    expect(query().get('q')).toBe('khan');
    expect(query().get('status')).toBe('locked');
    expect(query().get('roleId')).toBe('role_institute');
  });

  it('omits a filter rather than sending it empty', async () => {
    // `status=` is not "no filter" to the API — it is validated against a fixed set and
    // an empty value comes back as a 400.
    fetchMock.mockResolvedValueOnce(envelope({ items: [], total: 0 }));
    await usersService.listUsers({ q: '', status: undefined, roleId: '' });

    expect(query().has('q')).toBe(false);
    expect(query().has('status')).toBe(false);
    expect(query().has('roleId')).toBe(false);
  });

  it('trims the search text, and treats whitespace as no search', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ items: [], total: 0 }));
    await usersService.listUsers({ q: '  khan  ' });
    expect(query().get('q')).toBe('khan');

    fetchMock.mockResolvedValueOnce(envelope({ items: [], total: 0 }));
    await usersService.listUsers({ q: '   ' });
    expect(query().has('q')).toBe(false);
  });
});

describe('usersService.getUser', () => {
  it('reads one account', async () => {
    fetchMock.mockResolvedValueOnce(envelope(USER));
    await expect(usersService.getUser('usr_1')).resolves.toMatchObject({ id: 'usr_1' });
    expect(lastCall()[0]).toContain('/users/usr_1');
  });
});

describe('usersService.updateUser', () => {
  it('patches only what it is given', async () => {
    fetchMock.mockResolvedValueOnce(envelope(USER));
    await usersService.updateUser('usr_1', { fullName: 'Ayesha K' });

    const [url, init] = lastCall();
    expect(url).toContain('/users/usr_1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ fullName: 'Ayesha K' });
  });

  it('carries an explicit null through, because null means unlink', async () => {
    fetchMock.mockResolvedValueOnce(envelope(USER));
    await usersService.updateUser('usr_1', { instituteId: null });
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({ instituteId: null });
  });

  it('surfaces a duplicate email as the server states it', async () => {
    fetchMock.mockResolvedValueOnce(failure(409, 'A user with that email already exists'));
    await expect(
      usersService.updateUser('usr_1', { email: 'taken@oses.pk' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('usersService.deleteUser', () => {
  it('deletes by id', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ message: 'User deleted.' }));
    await usersService.deleteUser('usr_1');

    const [url, init] = lastCall();
    expect(url).toContain('/users/usr_1');
    expect(init.method).toBe('DELETE');
  });

  it('passes the server refusal through', async () => {
    fetchMock.mockResolvedValueOnce(failure(400, 'Cannot delete the last active Super Admin.'));
    await expect(usersService.deleteUser('usr_1')).rejects.toMatchObject({
      status: 400,
      message: 'Cannot delete the last active Super Admin.',
    });
  });
});
