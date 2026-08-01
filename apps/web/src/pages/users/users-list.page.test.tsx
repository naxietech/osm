import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@oses/types';

import { UsersListPage } from './users-list.page';

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
  status: 'suspended' as const,
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

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/users']}>
        <UsersListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
    expect(within(await rowFor('Bilal Ahmed')).getByText('Suspended')).toBeInTheDocument();
  });

  it("says 'Never' when the user has not signed in yet", async () => {
    mockApi({ users: [SUSPENDED_USER], total: 1 });
    renderPage();
    expect(within(await rowFor('Bilal Ahmed')).getByText('Never')).toBeInTheDocument();
  });

  it('offers Suspend for an active account and Reactivate for a suspended one', async () => {
    mockApi({ users: [ACTIVE_USER, SUSPENDED_USER], total: 2 });
    renderPage();

    expect(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /suspend/i }),
    ).toBeInTheDocument();
    expect(
      within(await rowFor('Bilal Ahmed')).getByRole('button', { name: /reactivate/i }),
    ).toBeInTheDocument();
  });

  it('asks for confirmation before suspending, and sends nothing if cancelled', async () => {
    // Suspending signs the person out of every device — too destructive for one click.
    const fetchMock = mockApi();
    renderPage();

    await userEvent.click(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /suspend/i }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName(/suspend ayesha khan/i);
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
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /suspend/i }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^suspend$/i }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit)?.method === 'PATCH',
      );
      expect(patch).toBeDefined();
      expect(String(patch?.[0])).toContain('/users/usr_1/status');
      expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({ status: 'suspended' });
    });
  });

  it('reactivates without a confirmation — it is not destructive', async () => {
    const fetchMock = mockApi({ users: [SUSPENDED_USER], total: 1 });
    renderPage();

    await userEvent.click(
      within(await rowFor('Bilal Ahmed')).getByRole('button', { name: /reactivate/i }),
    );

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit)?.method === 'PATCH',
      );
      expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({ status: 'active' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("shows the server's reason when a suspension is refused", async () => {
    // The rule (no suspending yourself / the last Super Admin) lives on the server, so
    // the page must show what it said rather than guessing.
    mockApi({ statusResponse: failure(400, 'You cannot suspend your own account.') });
    renderPage();

    await userEvent.click(
      within(await rowFor('Ayesha Khan')).getByRole('button', { name: /suspend/i }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^suspend$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot suspend your own account.',
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
});
