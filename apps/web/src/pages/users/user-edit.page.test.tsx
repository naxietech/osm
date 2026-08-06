import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks/use-auth';

import { UserEditPage } from './user-edit.page';

const SIGNED_IN = {
  id: 'usr_admin',
  email: 'admin@oses.pk',
  role: UserRole.SUPER_ADMIN,
  roleId: 'role_super_admin',
  fullName: 'Super Admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ROLES = [
  {
    id: 'role_admin',
    code: 'admin',
    name: 'Admin',
    isSystem: true,
    grants: [],
    createdAt: 'x',
  },
  {
    id: 'role_institute',
    code: 'institute',
    name: 'Institute',
    isSystem: true,
    grants: [{ action: 'students.manage', scope: 'own-institute' }],
    createdAt: 'x',
  },
  {
    id: 'role_checker',
    code: 'checker',
    name: 'Evaluator',
    isSystem: true,
    grants: [{ action: 'marking.mark', scope: 'all' }],
    createdAt: 'x',
  },
];

const TARGET = {
  id: 'usr_1',
  email: 'ayesha@oses.pk',
  role: UserRole.INSTITUTE,
  roleId: 'role_institute',
  instituteId: 'sch_001',
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

interface MockOptions {
  user?: unknown;
  getResponse?: Response;
  patchResponse?: Response;
  deleteResponse?: Response;
}

function mockApi(options: MockOptions = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/auth/me')) return Promise.resolve(envelope(SIGNED_IN));
    if (url.includes('/auth/permissions')) return Promise.resolve(envelope([]));
    if (url.includes('/roles')) return Promise.resolve(envelope(ROLES));
    if (init?.method === 'PATCH') {
      return Promise.resolve(options.patchResponse ?? envelope(options.user ?? TARGET));
    }
    if (init?.method === 'DELETE') {
      return Promise.resolve(options.deleteResponse ?? envelope({ message: 'User deleted.' }));
    }
    if (url.includes('/users/')) {
      return Promise.resolve(options.getResponse ?? envelope(options.user ?? TARGET));
    }
    return Promise.resolve(failure(404, 'Not found'));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Stands in for the users list, exposing the notice it was handed via router state. */
function ListStub(): React.ReactElement {
  const state = useLocation().state as { notice?: string } | null;
  return <div data-testid="list-state">{state?.notice ?? ''}</div>;
}

function renderPage(id = 'usr_1'): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/users/${id}/edit`]}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/users/:id/edit" element={<UserEditPage />} />
            <Route path="/admin/users" element={<ListStub />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The body of the last PATCH the page sent. */
function lastPatchBody(fetchMock: ReturnType<typeof vi.fn>): unknown {
  const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PATCH');
  return JSON.parse(String((call?.[1] as RequestInit).body));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UserEditPage', () => {
  it('loads the account by its id and fills the form', async () => {
    mockApi();
    renderPage();

    expect(await screen.findByDisplayValue('Ayesha Khan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ayesha@oses.pk')).toBeInTheDocument();
  });

  it('never offers a password field — that is its own endpoint', async () => {
    mockApi();
    renderPage();

    await screen.findByDisplayValue('Ayesha Khan');
    expect(screen.queryByLabelText(/temporary password/i)).not.toBeInTheDocument();
  });

  it('sends only the fields that changed', async () => {
    // PATCH treats every key present as a deliberate change, and rejects an empty body —
    // so sending the whole form back would re-assert values nobody touched.
    const fetchMock = mockApi();
    renderPage();

    const name = await screen.findByDisplayValue('Ayesha Khan');
    await userEvent.clear(name);
    await userEvent.type(name, 'Ayesha K');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(lastPatchBody(fetchMock)).toEqual({ fullName: 'Ayesha K' }));
  });

  it('keeps Save disabled until something actually changes', async () => {
    mockApi();
    renderPage();

    await screen.findByDisplayValue('Ayesha Khan');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('warns that changing the role signs the user out', async () => {
    mockApi();
    renderPage();

    await screen.findByDisplayValue('Ayesha Khan');
    await userEvent.click(screen.getByRole('combobox', { name: /role/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Evaluator' }));

    expect(await screen.findByText(/signs this user out of every device/i)).toBeInTheDocument();
  });

  it('unlinks the institute as null, not as an empty string', async () => {
    // The API reads `null` as "unlink" and `''` as an invalid value; an Evaluator may hold
    // an institute or not, so clearing it has to mean something precise.
    const fetchMock = mockApi({ user: { ...TARGET, roleId: 'role_checker' } });
    renderPage();

    await screen.findByDisplayValue('Ayesha Khan');
    await userEvent.click(screen.getByRole('combobox', { name: /institute/i }));
    await userEvent.click(await screen.findByRole('option', { name: /no institute/i }));

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(lastPatchBody(fetchMock)).toEqual({ instituteId: null }));
  });

  it('shows the API refusal rather than restating the rule', async () => {
    const fetchMock = mockApi({
      patchResponse: failure(400, 'You cannot change your own role.'),
    });
    renderPage();

    const name = await screen.findByDisplayValue('Ayesha Khan');
    await userEvent.clear(name);
    await userEvent.type(name, 'Someone Else');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot change your own role/i);
    void fetchMock;
  });

  it('explains what delete costs before asking to confirm', async () => {
    mockApi();
    renderPage();

    await screen.findByDisplayValue('Ayesha Khan');
    expect(screen.getByText(/stays taken/i)).toBeInTheDocument();
    expect(screen.getByText(/use deactivate on the users list instead/i)).toBeInTheDocument();
  });

  it('sends nothing if the delete confirmation is cancelled', async () => {
    const fetchMock = mockApi();
    renderPage();

    await screen.findByDisplayValue('Ayesha Khan');
    await userEvent.click(screen.getByRole('button', { name: /delete user/i }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'DELETE'),
    ).toBe(false);
  });

  it('deletes once confirmed and returns to the list', async () => {
    const fetchMock = mockApi();
    renderPage();

    await screen.findByDisplayValue('Ayesha Khan');
    await userEvent.click(screen.getByRole('button', { name: /delete user/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^delete user$/i }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit)?.method === 'DELETE',
      );
      expect(String(call?.[0])).toContain('/users/usr_1');
    });
    expect(await screen.findByTestId('list-state')).toBeInTheDocument();
  });

  it('refuses to let you delete your own account', async () => {
    mockApi({ user: { ...TARGET, id: SIGNED_IN.id } });
    renderPage(SIGNED_IN.id);

    await screen.findByDisplayValue('Ayesha Khan');
    expect(screen.getByRole('button', { name: /delete user/i })).toBeDisabled();
    expect(screen.getByText(/cannot delete your own account/i)).toBeInTheDocument();
  });

  it('explains a failed load instead of showing an empty form', async () => {
    mockApi({ getResponse: failure(404, 'User not found') });
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  describe('confirmation messages', () => {
    /** The router state the page navigated away with — how the list is told what happened. */
    function noticeAfter(): string | undefined {
      return (screen.getByTestId('list-state').textContent ?? undefined) || undefined;
    }

    it('hands a confirmation to the list after saving', async () => {
      mockApi();
      renderPage();

      const name = await screen.findByDisplayValue('Ayesha Khan');
      await userEvent.clear(name);
      await userEvent.type(name, 'Ayesha K');
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByTestId('list-state');
      expect(noticeAfter()).toMatch(/updated\./i);
    });

    it('says the role change signed them out, when that is what happened', async () => {
      mockApi();
      renderPage();

      await screen.findByDisplayValue('Ayesha Khan');
      await userEvent.click(screen.getByRole('combobox', { name: /role/i }));
      await userEvent.click(await screen.findByRole('option', { name: 'Evaluator' }));
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByTestId('list-state');
      expect(noticeAfter()).toMatch(/signed them out of every device/i);
    });

    it('hands over a confirmation after deleting too', async () => {
      mockApi();
      renderPage();

      await screen.findByDisplayValue('Ayesha Khan');
      await userEvent.click(screen.getByRole('button', { name: /delete user/i }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /^delete user$/i }));

      await screen.findByTestId('list-state');
      expect(noticeAfter()).toMatch(/deleted\./i);
    });

    it('lets a delete failure be dismissed', async () => {
      mockApi({ deleteResponse: failure(400, 'Cannot delete the last active Super Admin.') });
      renderPage();

      await screen.findByDisplayValue('Ayesha Khan');
      await userEvent.click(screen.getByRole('button', { name: /delete user/i }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /^delete user$/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/last active Super Admin/i);
      await userEvent.click(screen.getByRole('button', { name: /dismiss error/i }));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
  });
});
