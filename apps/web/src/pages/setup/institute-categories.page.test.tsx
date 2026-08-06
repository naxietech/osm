import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InstituteCategoriesPage } from './institute-categories.page';

const CATEGORY = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'SCH',
  name: 'School',
  description: 'Primary and secondary schools',
  isActive: true,
  version: 3,
  questions: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      text: 'Are you an ed-tech institute?',
      type: 'radio' as const,
      required: true,
      options: ['Yes', 'No'],
    },
  ],
};

function envelope(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failure(status: number, message: string): Response {
  return new Response(JSON.stringify({ success: false, error: 'Conflict', message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockApi(
  options: { patchResponse?: Response; deleteResponse?: Response } = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'PATCH') {
      return Promise.resolve(options.patchResponse ?? envelope({ ...CATEGORY, version: 4 }));
    }
    if (method === 'DELETE') {
      return Promise.resolve(options.deleteResponse ?? envelope({ message: 'Deleted.' }));
    }
    void input;
    return Promise.resolve(envelope([CATEGORY]));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <InstituteCategoriesPage />
    </QueryClientProvider>,
  );
}

/** The body of the last request made with the given method. */
function lastBody(fetchMock: ReturnType<typeof vi.fn>, method: string): unknown {
  const call = [...fetchMock.mock.calls]
    .reverse()
    .find(([, init]) => (init as RequestInit)?.method === method);
  return JSON.parse(String((call?.[1] as RequestInit).body));
}

async function openEdit(): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: /^Edit$/i }));
}

afterEach(() => vi.unstubAllGlobals());

describe('InstituteCategoriesPage', () => {
  it('lists what the API returns', async () => {
    mockApi();
    renderPage();
    expect(await screen.findByText('School')).toBeInTheDocument();
  });

  it('sends the version it loaded, so a stale save is refused rather than applied', async () => {
    const fetchMock = mockApi();
    renderPage();
    await openEdit();

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => expect(lastBody(fetchMock, 'PATCH')).toMatchObject({ version: 3 }));
  });

  it('sends each existing question back with its id', async () => {
    // Without the id the API's reconciler reads every question as new: it would re-create the
    // list and strand every institute answer already given against the originals.
    const fetchMock = mockApi();
    renderPage();
    await openEdit();

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => {
      const body = lastBody(fetchMock, 'PATCH') as { questions: Array<{ id?: string }> };
      expect(body.questions[0]?.id).toBe(CATEGORY.questions[0]!.id);
    });
  });

  it('tells the editor to reload when someone else saved first', async () => {
    // The one path that must never retry: retrying is precisely the overwrite the version check
    // exists to prevent.
    mockApi({
      patchResponse: failure(409, 'This category was changed by someone else. Reload and retry.'),
    });
    renderPage();
    await openEdit();

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(await screen.findByText(/Someone else saved first/i)).toBeInTheDocument();
    expect(screen.getByText(/changed by someone else/i)).toBeInTheDocument();
  });

  it('keeps the form open after a conflict, so the work is not lost', async () => {
    mockApi({ patchResponse: failure(409, 'Changed by someone else.') });
    renderPage();
    await openEdit();

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));
    await screen.findByText(/Someone else saved first/i);
    expect(screen.getByText(/Edit Category/i)).toBeInTheDocument();
  });

  it('switches a category off through its own route, not through an edit', async () => {
    const fetchMock = mockApi();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Deactivate/i }));

    await waitFor(() => {
      const call = [...fetchMock.mock.calls]
        .reverse()
        .find(([, init]) => (init as RequestInit)?.method === 'PATCH');
      expect(String(call?.[0])).toContain('/status');
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ isActive: false });
    });
  });

  it('shows the API refusal when a category is still in use', async () => {
    mockApi({
      deleteResponse: failure(409, 'This category is in use by one or more institutes.'),
    });
    renderPage();
    await userEvent.click(await screen.findByTitle(/Delete category/i));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Delete category$/i }));

    expect(await screen.findByText(/in use by one or more institutes/i)).toBeInTheDocument();
  });
});
