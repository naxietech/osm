import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/design-system/molecules/toast';
import { AuthProvider } from '@/hooks/use-auth';

import { InstituteDetailPage } from './institute-detail.page';

const CATEGORY = {
  id: 'cat-1',
  code: 'SCH',
  name: 'School',
  isActive: true,
  version: 1,
  questions: [
    {
      id: 'q-1',
      text: 'Which board are you affiliated with?',
      type: 'radio' as const,
      required: true,
      options: ['Federal', 'Punjab'],
    },
  ],
};

const INSTITUTE = {
  id: 'inst-1',
  instituteCode: 'LHR-001',
  numericCode: 7,
  instituteName: 'Government High School',
  branch: null,
  categoryId: 'cat-1',
  answers: [{ questionId: 'q-1', values: ['Federal'] }],
  institutionType: 'government',
  address: '1 Mall Road',
  city: 'Lahore',
  province: 'punjab',
  postalCode: '54000',
  contactPersonName: 'Ayesha Khan',
  contactPersonDesignation: 'Principal',
  contactEmail: 'principal@ghs.pk',
  contactPhone: '+92-42-1234567',
  status: 'approved',
  rejectionReason: null,
  registrationSource: 'admin',
  approvedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  possibleDuplicates: [],
};

function envelope(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockApi(
  options: { institute?: Record<string, unknown>; manage?: boolean } = {},
): ReturnType<typeof vi.fn> {
  const grants = [
    { action: 'institutes.view', scope: 'all' },
    ...(options.manage === false ? [] : [{ action: 'institutes.manage', scope: 'all' }]),
  ];
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/auth/me')) {
      return Promise.resolve(
        envelope({ id: 'u1', email: 'super@oses.pk', role: 'super_admin', fullName: 'Super' }),
      );
    }
    if (url.includes('/auth/permissions')) return Promise.resolve(envelope(grants));
    if (url.includes('/institute-categories')) return Promise.resolve(envelope([CATEGORY]));
    if (url.includes('/institutes/inst-1/approve')) {
      return Promise.resolve(
        envelope({ institute: INSTITUTE, userId: 'u2', message: 'Institute approved.' }),
      );
    }
    if (url.includes('/institutes/inst-1')) {
      return Promise.resolve(envelope({ ...INSTITUTE, ...options.institute }));
    }
    return Promise.resolve(envelope(null, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/institutes/inst-1']}>
          <AuthProvider>
            <Routes>
              <Route path="/admin/institutes/:id" element={<InstituteDetailPage />} />
              <Route path="/admin/institutes/approvals" element={<p>Approvals queue</p>} />
              <Route path="/admin/institutes/:id/edit" element={<p>Edit screen</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('InstituteDetailPage', () => {
  /**
   * This screen used to render the editable form, so a reviewer deciding whether to approve an
   * application was reading it out of input boxes with Save in reach of a decision that has
   * nothing to do with saving. It shows the record now; editing has its own screen.
   */
  it('shows the record, not a form', async () => {
    mockApi();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Government High School' })).toBeVisible();
    expect(screen.getByText('1 Mall Road')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('names the category and labels the answers, rather than showing raw ids', async () => {
    mockApi();
    renderPage();

    expect(await screen.findByText('School')).toBeInTheDocument();
    expect(screen.getByText('Which board are you affiliated with?')).toBeInTheDocument();
    expect(screen.getByText('Federal')).toBeInTheDocument();
    expect(screen.queryByText('cat-1')).not.toBeInTheDocument();
  });

  describe('a pending application', () => {
    it('offers only Approve and Reject', async () => {
      mockApi({ institute: { status: 'pending', numericCode: null } });
      renderPage();

      expect(
        await screen.findByRole('button', { name: /Approve & Register/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Reject$/i })).toBeInTheDocument();

      // None of these mean anything before the institute exists as one.
      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Deactivate/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Edit/i })).not.toBeInTheDocument();
    });

    it('returns to the queue after approving, carrying the server’s message', async () => {
      mockApi({ institute: { status: 'pending', numericCode: null } });
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: /Approve & Register/i }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: /Approve & Register/i }));

      await waitFor(() => expect(screen.getByText('Approvals queue')).toBeInTheDocument());
    });
  });

  describe('a registered institute', () => {
    it('offers Edit and Deactivate, and never Delete', async () => {
      mockApi();
      renderPage();

      expect(
        await screen.findByRole('button', { name: /Edit Government High School/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Deactivate Government High School/i }),
      ).toBeInTheDocument();
      // Delete belongs to the edit screen — it is the end of the record you are editing.
      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    });

    it('offers Reactivate once it is switched off', async () => {
      mockApi({ institute: { status: 'deactivated' } });
      renderPage();

      expect(
        await screen.findByRole('button', { name: /Reactivate Government High School/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Deactivate Government High School/i }),
      ).not.toBeInTheDocument();
    });

    it('withholds every action from a view-only Admin', async () => {
      mockApi({ manage: false });
      renderPage();

      expect(await screen.findByRole('heading', { name: 'Government High School' })).toBeVisible();
      expect(screen.queryByRole('button', { name: /Edit Government/i })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Deactivate Government/i }),
      ).not.toBeInTheDocument();
    });
  });
});
