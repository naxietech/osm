import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-client';
import { subjectsService } from './subjects.service';

const PHYSICS = { id: 'sub-uuid-1', code: 'PHY', name: 'Physics', isActive: true };

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

describe('subjectsService.listSubjects', () => {
  it('asks for every subject by default, deactivated ones included', async () => {
    fetchMock.mockResolvedValueOnce(envelope([PHYSICS]));

    await expect(subjectsService.listSubjects()).resolves.toEqual([PHYSICS]);

    const [url] = lastCall();
    expect(url).toContain('/subjects');
    // No filter at all — the management screen must be able to see and revive a deactivated row.
    expect(url).not.toContain('activeOnly');
  });

  it('adds the filter only when asked', async () => {
    fetchMock.mockResolvedValueOnce(envelope([]));
    await subjectsService.listSubjects({ activeOnly: true });
    expect(lastCall()[0]).toContain('/subjects?activeOnly=true');
  });

  it('does not add the filter for activeOnly: false', async () => {
    fetchMock.mockResolvedValueOnce(envelope([]));
    await subjectsService.listSubjects({ activeOnly: false });
    expect(lastCall()[0]).not.toContain('activeOnly');
  });

  it('sends cookies — the route needs the subjects.manage grant', async () => {
    fetchMock.mockResolvedValueOnce(envelope([]));
    await subjectsService.listSubjects();
    expect(lastCall()[1].credentials).toBe('include');
  });

  it('surfaces a missing grant as a 403', async () => {
    fetchMock.mockResolvedValueOnce(failure(403, 'Insufficient permissions for this action'));
    await expect(subjectsService.listSubjects()).rejects.toMatchObject({ status: 403 });
  });
});

describe('subjectsService.getSubject', () => {
  it('reads one subject by id', async () => {
    fetchMock.mockResolvedValueOnce(envelope(PHYSICS));
    await expect(subjectsService.getSubject('sub-uuid-1')).resolves.toEqual(PHYSICS);
    expect(lastCall()[0]).toContain('/subjects/sub-uuid-1');
  });
});

describe('subjectsService.createSubject', () => {
  it('posts the code and name', async () => {
    fetchMock.mockResolvedValueOnce(envelope(PHYSICS));

    await subjectsService.createSubject({ code: 'PHY', name: 'Physics' });

    const [url, init] = lastCall();
    expect(url).toContain('/subjects');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ code: 'PHY', name: 'Physics' });
  });

  it('surfaces a duplicate code as a 409 carrying the server wording', async () => {
    // The UI must show this message as-is; restating the rule locally is how copy goes stale.
    fetchMock.mockResolvedValueOnce(failure(409, 'A subject with code "PHY" already exists'));

    const error = await subjectsService
      .createSubject({ code: 'PHY', name: 'Physics' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: 'A subject with code "PHY" already exists',
    });
  });
});

describe('subjectsService.updateSubject', () => {
  it('patches only the fields it was given', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ ...PHYSICS, name: 'Physics (Higher)' }));

    await subjectsService.updateSubject('sub-uuid-1', { name: 'Physics (Higher)' });

    const [url, init] = lastCall();
    expect(url).toContain('/subjects/sub-uuid-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Physics (Higher)' });
  });

  it('surfaces a taken code as a 409', async () => {
    fetchMock.mockResolvedValueOnce(failure(409, 'A subject with code "BIO" already exists'));
    await expect(
      subjectsService.updateSubject('sub-uuid-1', { code: 'BIO' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('subjectsService.setSubjectStatus', () => {
  it('sends the target state, not a toggle', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ ...PHYSICS, isActive: false }));

    await subjectsService.setSubjectStatus('sub-uuid-1', false);

    const [url, init] = lastCall();
    expect(url).toContain('/subjects/sub-uuid-1/status');
    expect(init.method).toBe('PATCH');
    // An explicit target means a double submit lands on the same state rather than flipping back.
    expect(JSON.parse(String(init.body))).toEqual({ isActive: false });
  });

  it('reactivates with the same route', async () => {
    fetchMock.mockResolvedValueOnce(envelope(PHYSICS));
    await subjectsService.setSubjectStatus('sub-uuid-1', true);
    expect(JSON.parse(String(lastCall()[1].body))).toEqual({ isActive: true });
  });
});
