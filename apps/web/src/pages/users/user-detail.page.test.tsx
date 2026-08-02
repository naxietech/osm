import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks/use-auth';

import { UserDetailPage } from './user-detail.page';

/** Whoever is signed in while these tests run — the role catalogue only loads for a session. */
const SIGNED_IN = {
  id: 'usr_admin',
  email: 'admin@oses.pk',
  role: UserRole.SUPER_ADMIN,
  roleId: 'role_super_admin',
  fullName: 'Super Admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ROLES = [
  { id: 'role_admin', name: 'Admin', isSystem: true, grants: [], createdAt: 'x' },
  {
    id: 'role_institute',
    name: 'Institute',
    isSystem: true,
    grants: [{ action: 'students.manage', scope: 'own-institute' }],
    createdAt: 'x',
  },
  // Evaluator holds only global grants, so the institute is offered but not demanded —
  // with one they are school-specific, without one they mark across all institutes.
  {
    id: 'role_checker',
    name: 'Evaluator',
    isSystem: true,
    grants: [{ action: 'marking.mark', scope: 'all' }],
    createdAt: 'x',
  },
];

const CREATED = {
  id: 'usr_new',
  email: 'new@oses.pk',
  role: UserRole.ADMIN,
  roleId: 'role_admin',
  fullName: 'New Person',
  createdAt: '2026-07-31T00:00:00.000Z',
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

/** POST /users answers with `createResponse`; GET /roles always succeeds. */
function mockApi(createResponse: Response = envelope(CREATED)): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // Must come first: the role catalogue only loads for a signed-in user now.
    if (url.includes('/auth/me')) return Promise.resolve(envelope(SIGNED_IN));
    if (url.includes('/auth/permissions')) return Promise.resolve(envelope([]));
    if (url.includes('/roles')) return Promise.resolve(envelope(ROLES));
    if (url.includes('/users') && init?.method === 'POST') {
      return Promise.resolve(createResponse);
    }
    return Promise.resolve(failure(404, 'Not found'));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
): {
  queryClient: QueryClient;
} {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/users/new']}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/users/new" element={<UserDetailPage />} />
            <Route path="/admin/users" element={<div>Users List</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { queryClient };
}

/** SelectField is a listbox combobox, not a native <select> — open it, then pick. */
async function pickRole(roleName: string): Promise<void> {
  const user = userEvent.setup();
  const combobox = await screen.findByRole('combobox', { name: /role/i });
  await user.click(combobox);
  await user.click(await screen.findByRole('option', { name: roleName }));
}

/** Fill the form with valid values and submit. */
async function submitForm(overrides: { role?: string } = {}): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/full name/i), 'New Person');
  await user.type(screen.getByLabelText(/email address/i), 'new@oses.pk');
  await pickRole(overrides.role ?? 'Admin');
  await user.type(
    screen.getByLabelText(/temporary password/i, { selector: 'input' }),
    'temp-pass-1',
  );
  await user.click(screen.getByRole('button', { name: /create user/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UserDetailPage', () => {
  it('creates the user and returns to the list', async () => {
    const fetchMock = mockApi();
    renderPage();
    await submitForm();

    await waitFor(() => expect(screen.getByText('Users List')).toBeInTheDocument());

    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toMatchObject({
      fullName: 'New Person',
      email: 'new@oses.pk',
      roleId: 'role_admin',
      password: 'temp-pass-1',
    });
  });

  it('marks the cached user list stale so the new row actually shows', async () => {
    // Regression: the list is cached with a 30s staleTime, so navigating back without
    // invalidating served the old rows and the new user appeared to vanish — but only
    // sometimes, depending on how long the form was open.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['users', 0], { items: [], total: 0 });

    mockApi();
    renderPage(queryClient);
    await submitForm();

    await waitFor(() => expect(queryClient.getQueryState(['users', 0])?.isInvalidated).toBe(true));
  });

  it('requires a temporary password of at least 8 characters', async () => {
    mockApi();
    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), 'New Person');
    await user.type(screen.getByLabelText(/email address/i), 'new@oses.pk');
    await pickRole('Admin');
    await user.type(screen.getByLabelText(/temporary password/i, { selector: 'input' }), 'short7');
    await user.click(screen.getByRole('button', { name: /create user/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.queryByText('Users List')).not.toBeInTheDocument();
  });

  it('asks for an institute when the chosen role is institute-scoped', async () => {
    mockApi();
    renderPage();

    // Only the Role picker to begin with; choosing an own-institute role adds a second.
    expect(await screen.findAllByRole('combobox')).toHaveLength(1);
    await pickRole('Institute');

    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2));
  });

  it('offers an institute for an Evaluator without demanding one', async () => {
    // A general evaluator has no institute, so forcing one would make them uncreatable.
    mockApi();
    renderPage();

    await pickRole('Evaluator');
    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2));
    expect(screen.getByText(/mark across all institutes/i)).toBeInTheDocument();
  });

  it('creates a general Evaluator when no institute is picked', async () => {
    const fetchMock = mockApi();
    renderPage();
    await submitForm({ role: 'Evaluator' });

    await waitFor(() => expect(screen.getByText('Users List')).toBeInTheDocument());
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).not.toHaveProperty('instituteId');
  });

  it('drops the institute when the role is switched to one that cannot have it', async () => {
    // Regression: the institute field only *hides* when the role changes, so its value
    // used to survive and get submitted — creating e.g. an Admin caged inside one
    // institute, which the API stores and which then locks them out of every other one.
    const fetchMock = mockApi();
    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), 'New Person');
    await user.type(screen.getByLabelText(/email address/i), 'new@oses.pk');

    await pickRole('Institute');
    const instituteBox = (await screen.findAllByRole('combobox'))[1];
    await user.click(instituteBox as HTMLElement);
    await user.click(await screen.findByRole('option', { name: /Gulberg/i }));

    // Switch to a global role — the institute picker disappears.
    await pickRole('Admin');
    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(1));

    await user.type(
      screen.getByLabelText(/temporary password/i, { selector: 'input' }),
      'temp-pass-1',
    );
    await user.click(screen.getByRole('button', { name: /create user/i }));

    await waitFor(() => expect(screen.getByText('Users List')).toBeInTheDocument());
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).not.toHaveProperty('instituteId');
  });

  it("shows the server's wording when the email is taken", async () => {
    mockApi(failure(409, 'A user with that email already exists'));
    renderPage();
    await submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A user with that email already exists',
    );
    expect(screen.queryByText('Users List')).not.toBeInTheDocument();
  });
});
