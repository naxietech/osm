import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks/use-auth';

import { SubjectsPage } from './subjects.page';

/** Whoever is signed in while these tests run — the page only fetches when someone is. */
const SIGNED_IN = {
  id: 'usr_admin',
  email: 'admin@oses.pk',
  role: UserRole.SUPER_ADMIN,
  roleId: 'role_super_admin',
  fullName: 'Super Admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const PHYSICS = { id: 'sub-1', code: 'PHY', name: 'Physics', isActive: true };
const BIOLOGY = { id: 'sub-2', code: 'BIO', name: 'Biology', isActive: true };
const RETIRED = { id: 'sub-3', code: 'LAT', name: 'Latin', isActive: false };

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

interface MockOptions {
  subjects?: unknown[];
  /** What GET /subjects answers with, when the list itself should fail. */
  listResponse?: Response;
  /** What POST /subjects answers with. Defaults to echoing a created subject. */
  createResponse?: Response;
  /** What PATCH /subjects/:id answers with. */
  updateResponse?: Response;
  /** What PATCH /subjects/:id/status answers with. */
  statusResponse?: Response;
  /** Per-subject-id status answers, for testing two rows behaving differently. */
  statusResponseById?: Record<string, Response>;
}

function mockApi(options: MockOptions = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // Must come first: the list waits on a session.
    if (url.includes('/auth/me')) return Promise.resolve(envelope(SIGNED_IN));
    if (url.includes('/auth/permissions')) return Promise.resolve(envelope([]));

    if (url.includes('/status') && init?.method === 'PATCH') {
      // `/subjects/<id>/status` — lets a test answer differently per row.
      const id = url.split('/subjects/')[1]?.split('/')[0] ?? '';
      const perRow = options.statusResponseById?.[id];
      if (perRow) return Promise.resolve(perRow);
      return Promise.resolve(options.statusResponse ?? envelope({ ...PHYSICS, isActive: false }));
    }
    if (init?.method === 'PATCH') {
      return Promise.resolve(
        options.updateResponse ?? envelope({ ...PHYSICS, name: 'Physics (Higher)' }),
      );
    }
    if (init?.method === 'POST' && url.includes('/subjects')) {
      return Promise.resolve(
        options.createResponse ??
          envelope({ id: 'sub-9', code: 'CHEM', name: 'Chemistry', isActive: true }),
      );
    }
    if (url.includes('/subjects')) {
      return Promise.resolve(
        options.listResponse ?? envelope(options.subjects ?? [PHYSICS, BIOLOGY]),
      );
    }
    return Promise.resolve(failure(404, 'Not found'));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/subjects']}>
        <AuthProvider>
          <SubjectsPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The table row for a given subject. */
async function rowFor(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name);
  const row = cell.closest('tr');
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

/** Requests the mock saw, so a test can assert what was actually sent. */
function callsTo(
  fetchMock: ReturnType<typeof vi.fn>,
  fragment: string,
  method?: string,
): unknown[][] {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const matchesUrl = String(input).includes(fragment);
    const matchesMethod = method ? (init as RequestInit | undefined)?.method === method : true;
    return matchesUrl && matchesMethod;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SubjectsPage', () => {
  it('lists subjects from the API with their code and status', async () => {
    mockApi();
    renderPage();

    const row = await rowFor('Physics');
    expect(within(row).getByText('PHY')).toBeInTheDocument();
    expect(await screen.findByText('Biology')).toBeInTheDocument();
  });

  it('asks for every subject, deactivated ones included', async () => {
    // Hiding them here would make a deactivated subject unrecoverable — this is the only
    // screen that can bring one back.
    const fetchMock = mockApi({ subjects: [PHYSICS, RETIRED] });
    renderPage();

    await rowFor('Latin');
    expect(callsTo(fetchMock, 'activeOnly')).toHaveLength(0);
  });

  it('offers Activate on a deactivated subject and Deactivate on a live one', async () => {
    mockApi({ subjects: [PHYSICS, RETIRED] });
    renderPage();

    expect(
      within(await rowFor('Physics')).getByRole('button', { name: 'Deactivate subject' }),
    ).toBeInTheDocument();
    expect(
      within(await rowFor('Latin')).getByRole('button', { name: 'Activate subject' }),
    ).toBeInTheDocument();
  });

  it('filters as you search, across code and name', async () => {
    mockApi();
    renderPage();
    await rowFor('Physics');

    await userEvent.type(screen.getByRole('searchbox', { name: /search subjects/i }), 'bio');

    await waitFor(() => expect(screen.queryByText('Physics')).not.toBeInTheDocument());
    expect(screen.getByText('Biology')).toBeInTheDocument();
  });

  it('creates a subject and refetches the list so it appears without a reload', async () => {
    const fetchMock = mockApi();
    renderPage();
    await rowFor('Physics');

    await userEvent.click(screen.getByRole('button', { name: 'Add Subject' }));
    await userEvent.type(await screen.findByLabelText(/code/i), 'CHEM');
    await userEvent.type(screen.getByLabelText(/name/i), 'Chemistry');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Subject' }),
    );

    await waitFor(() => expect(callsTo(fetchMock, '/subjects', 'POST')).toHaveLength(1));
    const [, init] = callsTo(fetchMock, '/subjects', 'POST')[0] as [unknown, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ code: 'CHEM', name: 'Chemistry' });

    // Two list reads: the first render, then the invalidation after the save.
    await waitFor(() =>
      expect(callsTo(fetchMock, '/subjects', undefined).length).toBeGreaterThan(1),
    );
  });

  it('does not offer to save a blank Add form, or an Edit with nothing changed', async () => {
    // Formik reports a freshly-opened form as valid because validation has not run yet, so
    // gating on isValid alone left the button looking actionable when it would do nothing.
    mockApi();
    renderPage();
    await rowFor('Physics');

    await userEvent.click(screen.getByRole('button', { name: 'Add Subject' }));
    const addDialog = screen.getByRole('dialog');
    expect(within(addDialog).getByRole('button', { name: 'Add Subject' })).toBeDisabled();

    await userEvent.type(await screen.findByLabelText(/code/i), 'CHEM');
    await userEvent.type(screen.getByLabelText(/name/i), 'Chemistry');
    expect(within(addDialog).getByRole('button', { name: 'Add Subject' })).toBeEnabled();

    await userEvent.click(within(addDialog).getByRole('button', { name: 'Cancel' }));

    // Edit opens pre-filled, so there is nothing to save until something actually changes.
    await userEvent.click(
      within(await rowFor('Physics')).getByRole('button', { name: 'Edit subject' }),
    );
    const editDialog = await screen.findByRole('dialog');
    expect(within(editDialog).getByRole('button', { name: 'Save Changes' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/name/i), ' (Higher)');
    expect(within(editDialog).getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  it("shows the server's own words when the code is taken", async () => {
    // The 409 wording is the API's. Restating the rule here is how the two copies drift.
    const fetchMock = mockApi({
      createResponse: failure(409, 'A subject with code "PHY" already exists'),
    });
    renderPage();
    await rowFor('Physics');

    await userEvent.click(screen.getByRole('button', { name: 'Add Subject' }));
    await userEvent.type(await screen.findByLabelText(/code/i), 'PHY');
    await userEvent.type(screen.getByLabelText(/name/i), 'Physics Again');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Subject' }),
    );

    expect(await screen.findByText('A subject with code "PHY" already exists')).toBeInTheDocument();
    expect(callsTo(fetchMock, '/subjects', 'POST')).toHaveLength(1);
  });

  it('edits a subject, sending only what changed', async () => {
    const fetchMock = mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Physics')).getByRole('button', { name: 'Edit subject' }),
    );

    const name = await screen.findByLabelText(/name/i);
    await userEvent.clear(name);
    await userEvent.type(name, 'Physics (Higher)');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save Changes' }),
    );

    await waitFor(() => expect(callsTo(fetchMock, '/subjects/sub-1', 'PATCH')).toHaveLength(1));
    const [, init] = callsTo(fetchMock, '/subjects/sub-1', 'PATCH')[0] as [unknown, RequestInit];
    // The code was untouched, so it still goes as the loaded value rather than being dropped.
    expect(JSON.parse(String(init.body))).toEqual({ code: 'PHY', name: 'Physics (Higher)' });
  });

  it('asks before deactivating, and sends the explicit target state', async () => {
    const fetchMock = mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Physics')).getByRole('button', { name: 'Deactivate subject' }),
    );

    // Nothing is sent until the question is answered.
    expect(callsTo(fetchMock, '/status', 'PATCH')).toHaveLength(0);
    expect(await screen.findByText(/Deactivate Physics\?/)).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
    );

    await waitFor(() => expect(callsTo(fetchMock, '/status', 'PATCH')).toHaveLength(1));
    const [, init] = callsTo(fetchMock, '/status', 'PATCH')[0] as [unknown, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ isActive: false });
  });

  it('reactivates without asking — it is not the destructive direction', async () => {
    const fetchMock = mockApi({
      subjects: [RETIRED],
      statusResponse: envelope({ ...RETIRED, isActive: true }),
    });
    renderPage();

    await userEvent.click(
      within(await rowFor('Latin')).getByRole('button', { name: 'Activate subject' }),
    );

    await waitFor(() => expect(callsTo(fetchMock, '/status', 'PATCH')).toHaveLength(1));
    const [, init] = callsTo(fetchMock, '/status', 'PATCH')[0] as [unknown, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ isActive: true });
  });

  it('warns that usage cannot be checked before deactivating, without claiming a count', async () => {
    // Nothing references a subject yet, so a usage figure would be a hard zero — and a
    // confident "0 in use" reads as a check that was performed. The warning says so instead.
    mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Physics')).getByRole('button', { name: 'Deactivate subject' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/cannot yet check whether a subject is in use/i)).toBeVisible();
    expect(within(dialog).getByText(/keeps working and keeps its marks/i)).toBeVisible();
    // No fabricated number anywhere in the dialog.
    expect(within(dialog).queryByText(/\b0\b|in use by/i)).not.toBeInTheDocument();
  });

  it("keeps a failed row's message when a different row then succeeds", async () => {
    // One shared message slot used to mean the second row's success wiped the first row's
    // failure, and the admin was left believing both had worked.
    mockApi({
      statusResponseById: {
        'sub-1': failure(500, 'Physics could not be deactivated.'),
        'sub-2': envelope({ ...BIOLOGY, isActive: false }),
      },
    });
    renderPage();

    // Physics fails.
    await userEvent.click(
      within(await rowFor('Physics')).getByRole('button', { name: 'Deactivate subject' }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
    );
    const physicsRow = await rowFor('Physics');
    await waitFor(() =>
      expect(within(physicsRow).getByRole('alert')).toHaveTextContent(
        /could not be deactivated|not responding/i,
      ),
    );

    // Biology then succeeds.
    await userEvent.click(
      within(await rowFor('Biology')).getByRole('button', { name: 'Deactivate subject' }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
    );
    expect(await screen.findByText('Biology deactivated.')).toBeInTheDocument();

    // Physics's failure is still on its own row, not silently replaced.
    expect(within(await rowFor('Physics')).getByRole('alert')).toBeInTheDocument();
  });

  it('clears a row error when that row is retried', async () => {
    mockApi({ statusResponseById: { 'sub-1': failure(500, 'Nope.') } });
    renderPage();

    await userEvent.click(
      within(await rowFor('Physics')).getByRole('button', { name: 'Deactivate subject' }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
    );
    await waitFor(() =>
      expect(within(screen.getByRole('row', { name: /Physics/ })).getByRole('alert')).toBeVisible(),
    );

    // Retrying the same row drops the stale message rather than stacking a second one.
    await userEvent.click(
      within(await rowFor('Physics')).getByRole('button', { name: 'Deactivate subject' }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /Physics/ })).getAllByRole('alert'),
      ).toHaveLength(1),
    );
  });

  it('shows a readable message when the list itself fails', async () => {
    mockApi({ listResponse: failure(403, 'Insufficient permissions for this action') });
    renderPage();

    expect(await screen.findByText('Insufficient permissions for this action')).toBeInTheDocument();
  });
});
