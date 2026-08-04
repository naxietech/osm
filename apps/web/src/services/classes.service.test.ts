import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AcademicClass } from '@oses/types';

import { ApiError } from './api-client';
import { classesService } from './classes.service';

const CLASS_9: AcademicClass = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Class 9',
  ordinal: 9,
  description: 'Secondary — SSC Part I',
  isActive: true,
  version: 3,
  groups: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Science',
      isActive: true,
      subgroups: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Biology', isActive: true }],
    },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

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

/** The url, method and parsed body of the nth fetch. */
function callAt(index: number): { url: string; method: string; body: unknown } {
  const call = fetchMock.mock.calls[index];
  const init = (call?.[1] ?? {}) as { method?: string; body?: string };
  return {
    url: String(call?.[0]),
    method: init.method ?? 'GET',
    body: init.body ? (JSON.parse(init.body) as unknown) : undefined,
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listClasses', () => {
  it('unwraps the envelope and returns the classes with their trees', async () => {
    fetchMock.mockResolvedValueOnce(envelope([CLASS_9]));

    await expect(classesService.listClasses()).resolves.toEqual([CLASS_9]);
    expect(callAt(0).url).toContain('/classes');
  });

  it('asks for everything by default, so a deactivated class can still be restored', async () => {
    fetchMock.mockResolvedValueOnce(envelope([]));

    await classesService.listClasses();

    expect(callAt(0).url).not.toContain('activeOnly');
  });

  it('filters to active classes when asked, for pickers', async () => {
    fetchMock.mockResolvedValueOnce(envelope([]));

    await classesService.listClasses(true);

    expect(callAt(0).url).toContain('activeOnly=true');
  });
});

describe('createClass', () => {
  it('posts the class with its whole tree in one request', async () => {
    fetchMock.mockResolvedValueOnce(envelope(CLASS_9));

    await classesService.createClass({
      name: 'Class 9',
      ordinal: 9,
      groups: [{ name: 'Science', subgroups: [{ name: 'Biology' }] }],
    });

    const { url, method, body } = callAt(0);
    expect(url).toContain('/classes');
    expect(method).toBe('POST');
    expect(body).toEqual({
      name: 'Class 9',
      ordinal: 9,
      groups: [{ name: 'Science', subgroups: [{ name: 'Biology' }] }],
    });
  });

  it("surfaces the server's duplicate-name message rather than a generic one", async () => {
    fetchMock.mockResolvedValueOnce(failure(409, 'A class named "Class 9" already exists'));

    await expect(classesService.createClass({ name: 'Class 9', ordinal: 9 })).rejects.toMatchObject(
      { status: 409, message: 'A class named "Class 9" already exists', fromServer: true },
    );
  });
});

describe('updateClass', () => {
  it('patches the class and its tree together, carrying the loaded version', async () => {
    fetchMock.mockResolvedValueOnce(envelope(CLASS_9));

    await classesService.updateClass(CLASS_9.id, {
      version: 3,
      name: 'Class Nine',
      groups: [{ id: 'g1', name: 'Science', subgroups: [] }],
    });

    const { url, method, body } = callAt(0);
    expect(url).toContain(`/classes/${CLASS_9.id}`);
    expect(method).toBe('PATCH');
    // One request, so the rename and the tree cannot half-apply.
    expect(body).toEqual({
      version: 3,
      name: 'Class Nine',
      groups: [{ id: 'g1', name: 'Science', subgroups: [] }],
    });
  });

  it('sends no groups key at all when the tree is not being changed', async () => {
    fetchMock.mockResolvedValueOnce(envelope(CLASS_9));

    await classesService.updateClass(CLASS_9.id, { version: 3, name: 'Class Nine' });

    // Omitted means "leave the tree alone". Sending `groups: []` would deactivate every group.
    expect(callAt(0).body).toEqual({ version: 3, name: 'Class Nine' });
  });

  it("passes a stale-version conflict through in the server's words", async () => {
    fetchMock.mockResolvedValueOnce(
      failure(409, 'This class was changed by someone else. Reload it and try again.'),
    );

    await expect(classesService.updateClass(CLASS_9.id, { version: 1 })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('setStatus', () => {
  it('sends an explicit target state, so a double click is harmless', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ ...CLASS_9, isActive: false }));

    await classesService.setStatus(CLASS_9.id, false);

    const { url, method, body } = callAt(0);
    expect(url).toContain(`/classes/${CLASS_9.id}/status`);
    expect(method).toBe('PATCH');
    expect(body).toEqual({ isActive: false });
  });
});

describe('getClass', () => {
  it('reads one class by id', async () => {
    fetchMock.mockResolvedValueOnce(envelope(CLASS_9));

    await expect(classesService.getClass(CLASS_9.id)).resolves.toEqual(CLASS_9);
    expect(callAt(0).url).toContain(`/classes/${CLASS_9.id}`);
  });
});
