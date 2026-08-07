import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/design-system/molecules/toast';
import { AuthProvider } from '@/hooks/use-auth';

import { InstituteApprovalsPage } from './institute-approvals.page';

const CATEGORY = {
  id: 'cat-1',
  code: 'SCH',
  name: 'School',
  isActive: true,
  version: 1,
  questions: [],
};

const PENDING = {
  id: 'inst-1',
  instituteCode: 'LHR-001',
  numericCode: null,
  instituteName: 'Government High School',
  branch: null,
  categoryId: 'cat-1',
  answers: [],
  institutionType: 'government',
  address: '1 Mall Road',
  city: 'Lahore',
  province: 'punjab',
  postalCode: null,
  contactPersonName: 'Ayesha Khan',
  contactPersonDesignation: 'Principal',
  contactEmail: 'principal@ghs.pk',
  contactPhone: '+92-42-1234567',
  status: 'pending',
  rejectionReason: null,
  registrationSource: 'public',
  approvedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function envelope(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Records every institutes URL requested, so the filter assertions can read the query string. */
function mockApi(total = 1): { fetchMock: ReturnType<typeof vi.fn>; urls: string[] } {
  const urls: string[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/auth/me')) {
      return Promise.resolve(
        envelope({ id: 'u1', email: 'super@oses.pk', role: 'super_admin', fullName: 'Super' }),
      );
    }
    if (url.includes('/auth/permissions')) {
      return Promise.resolve(
        envelope([
          { action: 'institutes.view', scope: 'all' },
          { action: 'institutes.manage', scope: 'all' },
        ]),
      );
    }
    if (url.includes('/institute-categories')) return Promise.resolve(envelope([CATEGORY]));
    urls.push(url);
    return Promise.resolve(envelope({ items: [PENDING], total }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, urls };
}

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/institutes/approvals']}>
          <AuthProvider>
            <Routes>
              <Route path="/admin/institutes/approvals" element={<InstituteApprovalsPage />} />
              <Route path="/admin/institutes/:id" element={<p>Detail screen</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('InstituteApprovalsPage', () => {
  it('lists pending registrations in a table, named as pending', async () => {
    mockApi();
    renderPage();

    expect(await screen.findByRole('heading', { name: /Pending Institutes/i })).toBeVisible();
    // Wait for the rows: the table replaces a spinner, so asserting it first races the query.
    expect(await screen.findByText('Government High School')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('School')).toBeInTheDocument();
  });

  /**
   * Approving mints a login and draws a permanent institute number that is never reissued. It is
   * deliberately not reachable from a list of rows that all look alike — the only way through is
   * the detail screen, where the government code and the duplicate warning are in front of you.
   */
  it('offers View and nothing else — no decision is taken from the queue', async () => {
    mockApi();
    renderPage();

    expect(
      await screen.findByRole('button', { name: /View Government High School/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deactivate/i })).not.toBeInTheDocument();
  });

  it('opens the detail screen from the View action', async () => {
    mockApi();
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: /View Government High School/i }),
    );

    expect(await screen.findByText('Detail screen')).toBeInTheDocument();
  });

  it('asks the API for pending only, never the whole directory', async () => {
    const { urls } = mockApi();
    renderPage();

    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(urls[0]).toContain('status=pending');
  });

  it('narrows by category through the API rather than in the browser', async () => {
    const { urls } = mockApi();
    renderPage();
    await screen.findByText('Government High School');

    await userEvent.click(screen.getByRole('combobox', { name: /Category/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'School' }));

    await waitFor(() => expect(urls.some((u) => u.includes('categoryId=cat-1'))).toBe(true));
  });

  it('pages rather than silently truncating a long queue', async () => {
    // The screen used to ask for `limit: 100` and render whatever came back, so a queue longer
    // than that lost the rest with nothing on screen to say so.
    const { urls } = mockApi(60);
    renderPage();

    expect(await screen.findByText(/Page 1 of/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => expect(urls.some((u) => /offset=(?!0)\d+/.test(u))).toBe(true));
  });
});
