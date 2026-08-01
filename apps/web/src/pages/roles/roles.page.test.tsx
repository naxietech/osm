import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoleDetailPage } from './role-detail.page';
import { RolesListPage } from './roles-list.page';

const ROLES = [
  {
    id: 'role_super_admin',
    name: 'Super Admin',
    isSystem: true,
    grants: [
      { action: 'users.manage', scope: 'all' },
      { action: 'students.viewPII', scope: 'all' },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role_institute',
    name: 'Institute',
    isSystem: true,
    grants: [{ action: 'students.manage', scope: 'own-institute' }],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role_custom_1',
    name: 'Gulberg Registrar',
    isSystem: false,
    instituteId: 'sch_001',
    grants: [{ action: 'registrations.manage', scope: 'own-institute' }],
    createdAt: '2026-02-01T00:00:00.000Z',
  },
];

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

function mockRoles(response: Response = envelope(ROLES)): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response)),
  );
}

function renderAt(path: string): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/roles" element={<RolesListPage />} />
          <Route path="/admin/roles/:id" element={<RoleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RolesListPage', () => {
  it('lists the roles from the API', async () => {
    mockRoles();
    renderAt('/admin/roles');

    expect(await screen.findByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Institute')).toBeInTheDocument();
    expect(screen.getByText('Gulberg Registrar')).toBeInTheDocument();
  });

  it('marks seeded roles System and the rest Custom', async () => {
    mockRoles();
    renderAt('/admin/roles');

    const seeded = (await screen.findByText('Super Admin')).closest('tr');
    const custom = screen.getByText('Gulberg Registrar').closest('tr');
    expect(within(seeded as HTMLElement).getByText('System')).toBeInTheDocument();
    expect(within(custom as HTMLElement).getByText('Custom')).toBeInTheDocument();
  });

  it('names the owning institute, or Global when there is none', async () => {
    mockRoles();
    renderAt('/admin/roles');

    const custom = (await screen.findByText('Gulberg Registrar')).closest('tr');
    expect(
      within(custom as HTMLElement).getByText('Government High School Gulberg'),
    ).toBeInTheDocument();

    const seeded = screen.getByText('Super Admin').closest('tr');
    expect(within(seeded as HTMLElement).getByText('Global')).toBeInTheDocument();
  });

  it('offers no way to create or edit a role — the API has no write routes', async () => {
    mockRoles();
    renderAt('/admin/roles');
    await screen.findByText('Super Admin');

    expect(screen.queryByRole('button', { name: /create role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('explains a failed load instead of showing an empty table', async () => {
    mockRoles(failure(500, 'Internal server error'));
    renderAt('/admin/roles');
    expect(await screen.findByRole('alert')).toHaveTextContent(/not responding/i);
  });
});

describe('RoleDetailPage', () => {
  it('ticks the permissions the role holds and leaves the rest unticked', async () => {
    mockRoles();
    renderAt('/admin/roles/role_super_admin');

    expect(await screen.findByRole('heading', { name: 'Super Admin' })).toBeInTheDocument();
    // Granted actions get a "Granted" marker; ungranted ones get the empty box.
    expect(screen.getAllByLabelText('Granted')).toHaveLength(2);
    expect(screen.getAllByLabelText('Not granted').length).toBeGreaterThan(0);
  });

  it('shows the scope beside a scopeable grant', async () => {
    mockRoles();
    renderAt('/admin/roles/role_institute');

    expect(await screen.findByRole('heading', { name: 'Institute' })).toBeInTheDocument();
    expect(screen.getByText('Own institute only')).toBeInTheDocument();
  });

  it('says roles cannot be edited here', async () => {
    mockRoles();
    renderAt('/admin/roles/role_institute');
    expect(await screen.findByText(/cannot be edited here/i)).toBeInTheDocument();
  });

  it('handles a role id that does not exist', async () => {
    mockRoles();
    renderAt('/admin/roles/role_does_not_exist');
    expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument();
  });

  it('explains a failed load', async () => {
    mockRoles(failure(500, 'Internal server error'));
    renderAt('/admin/roles/role_institute');
    expect(await screen.findByRole('alert')).toHaveTextContent(/not responding/i);
  });
});
