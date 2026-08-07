import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/design-system/molecules/toast';
import { AuthProvider } from '@/hooks/use-auth';

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

/**
 * `error` is not decoration here. The page tells an optimistic-lock 409 from the two conflicts
 * that refuse the submission itself by this code, so a test that always sent 'Conflict' could
 * not distinguish the two behaviours it is checking.
 */
function failure(status: number, message: string, error = 'ConflictException'): Response {
  return new Response(JSON.stringify({ success: false, error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VERSION_CONFLICT = 'CategoryVersionConflict';

function mockApi(
  options: {
    patchResponse?: Response;
    deleteResponse?: Response;
    /** Omit the manage grant to exercise the Admin (view-only) rendering. */
    grants?: Array<{ action: string; scope: string }>;
    /** Override the listed category — `isActive: false` exercises the reactivate path. */
    category?: typeof CATEGORY;
  } = {},
): ReturnType<typeof vi.fn> {
  const grants = options.grants ?? [
    { action: 'institute-categories.view', scope: 'all' },
    { action: 'institute-categories.manage', scope: 'all' },
  ];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/auth/me')) {
      return Promise.resolve(
        envelope({ id: 'u1', email: 'super@oses.pk', role: 'super_admin', fullName: 'Super' }),
      );
    }
    if (url.includes('/auth/permissions')) return Promise.resolve(envelope(grants));
    const method = init?.method ?? 'GET';
    if (method === 'PATCH') {
      return Promise.resolve(options.patchResponse ?? envelope({ ...CATEGORY, version: 4 }));
    }
    if (method === 'DELETE') {
      return Promise.resolve(options.deleteResponse ?? envelope({ message: 'Deleted.' }));
    }
    return Promise.resolve(envelope([options.category ?? CATEGORY]));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthProvider>
            <InstituteCategoriesPage />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
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
  await userEvent.click(await screen.findByRole('button', { name: /Edit School/i }));
}

/** Delete now lives inside the edit form, so reaching it means opening the category first. */
async function openDelete(): Promise<void> {
  await openEdit();
  await userEvent.click(screen.getByRole('button', { name: /Delete Category/i }));
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
      patchResponse: failure(
        409,
        'This category was changed by someone else. Reload and retry.',
        VERSION_CONFLICT,
      ),
    });
    renderPage();
    await openEdit();

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(await screen.findByText(/Someone else saved first/i)).toBeInTheDocument();
    expect(screen.getByText(/changed by someone else/i)).toBeInTheDocument();
  });

  it('refetches after a conflict, so "reopen the form" is true advice', async () => {
    // Without this the cached row still holds the version we just lost with, and reopening
    // would resubmit it and 409 again — the banner would be telling the editor to do
    // something that cannot work.
    const fetchMock = mockApi({
      patchResponse: failure(409, 'Changed by someone else.', VERSION_CONFLICT),
    });
    renderPage();
    await openEdit();

    const getsBefore = fetchMock.mock.calls.filter(
      ([, init]) => ((init as RequestInit)?.method ?? 'GET') === 'GET',
    ).length;

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));
    await screen.findByText(/Someone else saved first/i);

    await waitFor(() => {
      const getsAfter = fetchMock.mock.calls.filter(
        ([, init]) => ((init as RequestInit)?.method ?? 'GET') === 'GET',
      ).length;
      expect(getsAfter).toBeGreaterThan(getsBefore);
    });
  });

  it('keeps the form open after a conflict, so the work is not lost', async () => {
    mockApi({ patchResponse: failure(409, 'Changed by someone else.', VERSION_CONFLICT) });
    renderPage();
    await openEdit();

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));
    await screen.findByText(/Someone else saved first/i);
    expect(screen.getByText(/Edit Category/i)).toBeInTheDocument();
  });

  it('switches a category off through its own route, not through an edit', async () => {
    const fetchMock = mockApi();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Deactivate School/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Deactivate$/i }));

    await waitFor(() => {
      const call = [...fetchMock.mock.calls]
        .reverse()
        .find(([, init]) => (init as RequestInit)?.method === 'PATCH');
      expect(String(call?.[0])).toContain('/status');
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ isActive: false });
    });
  });

  it('withholds every control from a view-only Admin', async () => {
    // Admin holds institute-categories.view but not .manage. Controls are absent rather than
    // disabled — a greyed-out button only invites "why can't I?". The API refuses these calls
    // with a 403 regardless; this is presentation, not the guarantee.
    mockApi({ grants: [{ action: 'institute-categories.view', scope: 'all' }] });
    renderPage();

    expect(await screen.findByText('School')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Category/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit School/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deactivate School/i })).not.toBeInTheDocument();
  });

  /**
   * The bug this replaces: every 409 on an update was labelled "someone else saved first" and
   * carried reload advice. Two of the three conflicts on this route are the submission itself
   * being refused — reloading fixes neither, and the instruction was simply wrong.
   */
  it('does not tell the editor to reload for a conflict reloading cannot fix', async () => {
    mockApi({
      patchResponse: failure(
        409,
        'The question "Are you an ed-tech institute?" already has answers, so these options cannot be removed: Other.',
      ),
    });
    renderPage();
    await openEdit();

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));

    expect(await screen.findByText(/already has answers/i)).toBeInTheDocument();
    expect(screen.queryByText(/Someone else saved first/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reloading is the only safe move/i)).not.toBeInTheDocument();
  });

  it('names the question in the refusal, so the editor knows which one to fix', async () => {
    mockApi({
      patchResponse: failure(
        409,
        'The question "Are you an ed-tech institute?" already has answers, so these options cannot be removed: Other.',
      ),
    });
    renderPage();
    await openEdit();

    await userEvent.click(screen.getByRole('button', { name: /Save/i }));

    const banner = await screen.findByText(/already has answers/i);
    expect(banner).toHaveTextContent('Are you an ed-tech institute?');
    // A uuid in a user-facing message is a dead end — nothing on screen maps back to it.
    expect(banner).not.toHaveTextContent(CATEGORY.questions[0]!.id);
  });

  it('asks before deactivating, and says what it costs', async () => {
    const fetchMock = mockApi();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Deactivate School/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/disappears from the public registration form/i)).toBeVisible();

    // Nothing is sent until it is confirmed.
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PATCH')).toBe(
      false,
    );
  });

  it('asks before reactivating too, with the opposite message', async () => {
    const fetchMock = mockApi({ category: { ...CATEGORY, isActive: false } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Reactivate School/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/goes back on the public registration form/i)).toBeVisible();
    expect(within(dialog).queryByText(/disappears from the public/i)).toBeNull();

    await userEvent.click(within(dialog).getByRole('button', { name: /^Reactivate$/i }));

    await waitFor(() => {
      const call = [...fetchMock.mock.calls]
        .reverse()
        .find(([, init]) => (init as RequestInit)?.method === 'PATCH');
      expect(String(call?.[0])).toContain('/status');
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ isActive: true });
    });
  });

  it('shows an inactive category in red, not in the same grey as everything else', async () => {
    mockApi({ category: { ...CATEGORY, isActive: false } });
    renderPage();

    const badge = await screen.findByText('Inactive');
    expect(badge.className).toContain('danger');
  });

  it("shows a category's questions in a drawer, opened from its own row", async () => {
    mockApi();
    renderPage();
    await screen.findByText('School');

    // Hidden until asked for — the table is a list of categories, not of questions.
    expect(screen.queryByText('Are you an ed-tech institute?')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Show questions for School/i }));

    expect(await screen.findByText('Are you an ed-tech institute?')).toBeInTheDocument();
    expect(screen.getByText('Radio (choose one)')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('offers delete only from inside the edit form', async () => {
    mockApi();
    renderPage();
    await screen.findByText('School');

    // Not in the row: a destructive action with no undo should not sit one mis-click away.
    expect(screen.queryByRole('button', { name: /Delete Category/i })).not.toBeInTheDocument();

    await openEdit();
    expect(screen.getByRole('button', { name: /Delete Category/i })).toBeInTheDocument();
  });

  it('shows the API refusal when a category is still in use', async () => {
    mockApi({
      deleteResponse: failure(409, 'This category is in use by one or more institutes.'),
    });
    renderPage();
    await openDelete();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Delete category$/i }));

    expect(await screen.findByText(/in use by one or more institutes/i)).toBeInTheDocument();
  });
});
