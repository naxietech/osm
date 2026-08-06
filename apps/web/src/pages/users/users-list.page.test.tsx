import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks/use-auth';

import { UsersListPage } from './users-list.page';

/** Whoever is signed in while these tests run — the page only fetches when someone is. */
const SIGNED_IN = {
  id: 'usr_admin',
  email: 'admin@oses.pk',
  role: UserRole.SUPER_ADMIN,
  roleId: 'role_super_admin',
  fullName: 'Super Admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ROLES = [
  { id: 'role_super_admin', name: 'Super Admin', isSystem: true, grants: [], createdAt: 'x' },
  { id: 'role_institute', name: 'Institute', isSystem: true, grants: [], createdAt: 'x' },
];

const ACTIVE_USER = {
  id: 'usr_1',
  email: 'ayesha@oses.pk',
  role: UserRole.INSTITUTE,
  roleId: 'role_institute',
  instituteId: 'sch_001',
  fullName: 'Ayesha Khan',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'active' as const,
  lastLoginAt: '2026-07-30T10:00:00.000Z',
};

const SUSPENDED_USER = {
  ...ACTIVE_USER,
  id: 'usr_2',
  email: 'bilal@oses.pk',
  fullName: 'Bilal Ahmed',
  status: 'deactivate' as const,
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

interface MockOptions {
  users?: unknown[];
  total?: number;
  /** What PATCH /users/:id/status answers with. Defaults to success. */
  statusResponse?: Response;
  /** What GET /users answers with, when the list itself should fail. */
  listResponse?: Response;
  /** What POST /users/:id/reset-password answers with. Defaults to success. */
  resetResponse?: Response;
}

function mockApi(options: MockOptions = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // Must come first: the list and the roles both wait on a session now.
    if (url.includes('/auth/me')) return Promise.resolve(envelope(SIGNED_IN));
    if (url.includes('/auth/permissions')) return Promise.resolve(envelope([]));
    if (url.includes('/roles')) return Promise.resolve(envelope(ROLES));
    if (url.includes('/reset-password')) {
      return Promise.resolve(options.resetResponse ?? envelope({ message: 'Password reset.' }));
    }
    if (init?.method === 'PATCH') {
      return Promise.resolve(options.statusResponse ?? envelope({ message: 'Updated.' }));
    }
    if (url.includes('/users')) {
      return Promise.resolve(
        options.listResponse ??
          envelope({
            items: options.users ?? [ACTIVE_USER],
            total: options.total ?? (options.users ?? [ACTIVE_USER]).length,
          }),
      );
    }
    return Promise.resolve(failure(404, 'Not found'));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(entry = '/admin/users'): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <AuthProvider>
          <UsersListPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Render at a location that carries router state, as a redirect from the edit screen does. */
function renderPageWithState(pathname: string, state: unknown): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname, state }]}>
        <AuthProvider>
          <UsersListPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Every GET /users the page has made, as parsed query strings. */
function listCalls(fetchMock: ReturnType<typeof vi.fn>): URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/users?'))
    .map((url) => new URLSearchParams(url.slice(url.indexOf('?'))));
}

/** The table row for a given person. */
async function rowFor(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name);
  const row = cell.closest('tr');
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UsersListPage', () => {
  it('lists users from the API with their role and institute', async () => {
    mockApi();
    renderPage();

    const row = await rowFor('Ayesha Khan');
    expect(within(row).getByText('ayesha@oses.pk')).toBeInTheDocument();
    // Role name comes from GET /roles, resolved against the row's roleId.
    await waitFor(() => expect(within(row).getByText('Institute')).toBeInTheDocument());
    expect(within(row).getByText('Government High School Gulberg')).toBeInTheDocument();
  });

  it('shows the account status', async () => {
    mockApi({ users: [ACTIVE_USER, SUSPENDED_USER], total: 2 });
    renderPage();

    expect(within(await rowFor('Ayesha Khan')).getByText('Active')).toBeInTheDocument();
    expect(within(await rowFor('Bilal Ahmed')).getByText('Deactivated')).toBeInTheDocument();
  });

  it("says 'Never' when the user has not signed in yet", async () => {
    mockApi({ users: [SUSPENDED_USER], total: 1 });
    renderPage();
    expect(within(await rowFor('Bilal Ahmed')).getByText('Never')).toBeInTheDocument();
  });

  it('offers Deactivate for an active account and Reactivate for a deactivated one', async () => {
    mockApi({ users: [ACTIVE_USER, SUSPENDED_USER], total: 2 });
    renderPage();

    expect(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /deactivate/i }),
    ).toBeInTheDocument();
    expect(
      within(await rowFor('Bilal Ahmed')).getByRole('button', { name: /reactivate/i }),
    ).toBeInTheDocument();
  });

  it('asks for confirmation before deactivating, and sends nothing if cancelled', async () => {
    // Deactivating signs the person out of every device — too destructive for one click.
    const fetchMock = mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /deactivate/i }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName(/deactivate ayesha khan/i);
    expect(dialog).toHaveAccessibleDescription(/signed out of every device/i);

    await userEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PATCH')).toBe(
      false,
    );
  });

  it('sends the new status once the suspension is confirmed', async () => {
    const fetchMock = mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /deactivate/i }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit)?.method === 'PATCH',
      );
      expect(patch).toBeDefined();
      expect(String(patch?.[0])).toContain('/users/usr_1/status');
      expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({
        status: 'deactivate',
      });
    });
  });

  it("shows the server's reason when a suspension is refused", async () => {
    // The rule (no deactivating yourself / the last Super Admin) lives on the server, so
    // the page must show what it said rather than guessing.
    mockApi({ statusResponse: failure(400, 'You cannot deactivate your own account.') });
    renderPage();

    await userEvent.click(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /deactivate/i }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot deactivate your own account.',
    );
  });

  it('resets a password through the dialog', async () => {
    const fetchMock = mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /reset password/i }),
    );

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/temporary password/i, { selector: 'input' }),
      'brand-new-1',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: /^reset password$/i }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url]) => String(url).includes('/reset-password'));
      expect(post).toBeDefined();
      expect(String(post?.[0])).toContain('/users/usr_1/reset-password');
      expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({
        password: 'brand-new-1',
      });
    });
  });

  it('will not submit a password shorter than the API allows', async () => {
    mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /reset password/i }),
    );
    const dialog = await screen.findByRole('dialog');

    // Empty to begin with, so confirm is unavailable until something valid is typed.
    expect(within(dialog).getByRole('button', { name: /^reset password$/i })).toBeDisabled();

    await userEvent.type(
      within(dialog).getByLabelText(/temporary password/i, { selector: 'input' }),
      'short7',
    );
    expect(within(dialog).getByRole('button', { name: /^reset password$/i })).toBeDisabled();
    expect(within(dialog).getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('confirms the reset happened and warns that the user was signed out', async () => {
    mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /reset password/i }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText(/temporary password/i, { selector: 'input' }),
      'brand-new-1',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: /^reset password$/i }));

    // Nothing on the row changes, so without this the admin can't tell it worked.
    expect(await screen.findByRole('status')).toHaveTextContent(/password reset/i);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('explains a failed load instead of showing an empty table', async () => {
    mockApi({ listResponse: failure(500, 'Internal server error') });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/not responding/i);
  });

  describe('search, filters and paging', () => {
    it('sends the typed text as ?q= once, after the keystrokes settle', async () => {
      const fetchMock = mockApi();
      renderPage();
      await rowFor('Ayesha Khan');

      await userEvent.type(screen.getByLabelText(/search users/i), 'khan');

      await waitFor(() =>
        expect(listCalls(fetchMock).some((p) => p.get('q') === 'khan')).toBe(true),
      );
      // Debounced: four keystrokes must not become four requests.
      expect(listCalls(fetchMock).filter((p) => p.get('q')).length).toBe(1);
    });

    it('filters by role', async () => {
      const fetchMock = mockApi();
      renderPage();
      await rowFor('Ayesha Khan');

      await userEvent.click(await screen.findByRole('combobox', { name: /role/i }));
      await userEvent.click(await screen.findByRole('option', { name: 'Institute' }));

      await waitFor(() =>
        expect(listCalls(fetchMock).some((p) => p.get('roleId') === 'role_institute')).toBe(true),
      );
    });

    it('filters by status', async () => {
      const fetchMock = mockApi();
      renderPage();
      await rowFor('Ayesha Khan');

      await userEvent.click(await screen.findByRole('combobox', { name: /status/i }));
      await userEvent.click(await screen.findByRole('option', { name: 'Deactivated' }));

      await waitFor(() =>
        expect(listCalls(fetchMock).some((p) => p.get('status') === 'deactivate')).toBe(true),
      );
    });

    it('reads its filters back out of the URL, so a link or a refresh keeps them', async () => {
      const fetchMock = mockApi();
      renderPage('/admin/users?q=khan&status=locked&roleId=role_institute');

      await waitFor(() => {
        const call = listCalls(fetchMock).at(-1);
        expect(call?.get('q')).toBe('khan');
        expect(call?.get('status')).toBe('locked');
        expect(call?.get('roleId')).toBe('role_institute');
      });
    });

    it('ignores a status the API would reject rather than sending it on', async () => {
      const fetchMock = mockApi();
      renderPage('/admin/users?status=nonsense');

      await waitFor(() => expect(listCalls(fetchMock).length).toBeGreaterThan(0));
      expect(listCalls(fetchMock).every((p) => p.get('status') === null)).toBe(true);
    });

    it('goes back to page 1 when a filter changes', async () => {
      // On page 3 of a large list, then narrowing: asking for rows 51-75 of a smaller result
      // set returns an empty page and reads as a broken search.
      const fetchMock = mockApi({ users: [ACTIVE_USER], total: 90 });
      renderPage('/admin/users?page=3');

      await waitFor(() => expect(listCalls(fetchMock).at(-1)?.get('offset')).toBe('50'));

      await userEvent.click(await screen.findByRole('combobox', { name: /status/i }));
      await userEvent.click(await screen.findByRole('option', { name: 'Active' }));

      await waitFor(() => {
        const call = listCalls(fetchMock).at(-1);
        expect(call?.get('status')).toBe('active');
        expect(call?.get('offset')).toBe('0');
      });
    });

    it('clears everything at once', async () => {
      const fetchMock = mockApi();
      renderPage('/admin/users?q=khan&status=active');

      await userEvent.click(await screen.findByRole('button', { name: /clear/i }));

      await waitFor(() => {
        const call = listCalls(fetchMock).at(-1);
        expect(call?.get('q')).toBeNull();
        expect(call?.get('status')).toBeNull();
      });
    });

    it('says the list is empty because of the filters, not because there are no users', async () => {
      mockApi({ users: [], total: 0 });
      renderPage('/admin/users?q=nobody');
      expect(await screen.findByText(/no users match those filters/i)).toBeInTheDocument();
    });
  });

  it('offers an edit link per row', async () => {
    mockApi();
    renderPage();
    expect(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /edit ayesha khan/i }),
    ).toBeInTheDocument();
  });

  describe('messages and confirmations', () => {
    it('confirms before reactivating, and says what it will do', async () => {
      // Reactivate and Deactivate sit in the same spot on every row, so a mis-click on a long
      // list would otherwise silently restore an account that was switched off deliberately.
      const fetchMock = mockApi({ users: [SUSPENDED_USER], total: 1 });
      renderPage();

      await userEvent.click(
        within(await rowFor('Bilal Ahmed')).getByRole('button', { name: /reactivate/i }),
      );

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveAccessibleName(/reactivate bilal ahmed/i);
      expect(dialog).toHaveAccessibleDescription(/sign in again immediately/i);
      expect(dialog).toHaveAccessibleDescription(/lockout from failed login attempts is cleared/i);

      // Nothing is sent until it is confirmed.
      expect(
        fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'PATCH'),
      ).toBe(false);
    });

    it('reactivates once confirmed, and says so', async () => {
      const fetchMock = mockApi({ users: [SUSPENDED_USER], total: 1 });
      renderPage();

      await userEvent.click(
        within(await rowFor('Bilal Ahmed')).getByRole('button', { name: /reactivate/i }),
      );
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /^reactivate$/i }));

      await waitFor(() => {
        const patch = fetchMock.mock.calls.find(
          ([, init]) => (init as RequestInit)?.method === 'PATCH',
        );
        expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({ status: 'active' });
      });
      expect(await screen.findByRole('status')).toHaveTextContent(/can sign in again now/i);
    });

    it('shows the confirmation handed over by the edit screen', async () => {
      mockApi();
      renderPageWithState('/admin/users', { notice: 'Ayesha Khan updated.' });
      expect(await screen.findByRole('status')).toHaveTextContent('Ayesha Khan updated.');
    });

    it('lets a success message be dismissed', async () => {
      mockApi();
      renderPageWithState('/admin/users', { notice: 'Ayesha Khan updated.' });

      const banner = await screen.findByRole('status');
      expect(banner).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /dismiss message/i }));
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });

    it('lets an action error be dismissed, but not a failed load', async () => {
      // A failed load leaves an empty table behind, so hiding the reason would read as
      // "there are no users".
      mockApi({ listResponse: failure(500, 'Internal server error') });
      renderPage();
      await screen.findByRole('alert');
      expect(screen.queryByRole('button', { name: /dismiss error/i })).not.toBeInTheDocument();
    });
  });
});
