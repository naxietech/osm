import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type SafeUser, UserRole } from '@oses/types';

import { AuthProvider, ClientProvider } from '@/hooks';
import { mockAuthApi } from '@/test-utils/api-mock';

import { RouterConfig } from './router';

/**
 * Mounts the real route tree. These cover the module route factories in ./modules —
 * in particular that a module shared by two roles (exams: admin + controller;
 * students: admin + institute) resolves under BOTH path prefixes, which is the thing
 * a typecheck cannot prove.
 */
/**
 * Sign a user in by making `GET /auth/me` answer with them — the session is server-side
 * now, so there is nothing to put in storage. `id` matters for the evaluator screens,
 * which resolve the signed-in user to their own checker record: pass the demo
 * evaluator's real id there, or those pages correctly find no checker and render their
 * empty state.
 */
function seed(role: UserRole, id = 'u'): void {
  const user: SafeUser = {
    id,
    email: 'u@oses.pk',
    role,
    fullName: 'User',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  mockAuthApi({ me: user });
}

/** The demo checker login (users.service seed), linked to checker chk_001. */
const EVALUATOR_USER_ID = 'usr_evaluator';

function renderAt(path: string): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ClientProvider>
            <React.Suspense fallback={<div>loading</div>}>
              <RouterConfig />
            </React.Suspense>
          </ClientProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Route components are lazy-loaded, so the first paint of a page waits on its chunk.
// Under a full-suite run that can exceed findBy's 1s default.
const FIND = { timeout: 5000 };

// The per-test budget that keeps this workable is set in vitest.config.ts (testTimeout),
// and must stay comfortably above FIND — see the note there.

describe('RouterConfig module composition', () => {
  it('mounts the shared exams module for ADMIN', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/exams/view');
    expect(await screen.findByRole('heading', { name: /exams/i }, FIND)).toBeInTheDocument();
  });

  it('mounts the same shared exams module for CONTROLLER', async () => {
    seed(UserRole.CONTROLLER);
    renderAt('/controller/exams/view');
    expect(await screen.findByRole('heading', { name: /exams/i }, FIND)).toBeInTheDocument();
  });

  it('mounts the shared students module for ADMIN', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/students/view');
    expect(await screen.findByRole('heading', { name: /students/i }, FIND)).toBeInTheDocument();
  });

  it('mounts the same shared students module for INSTITUTE', async () => {
    seed(UserRole.INSTITUTE);
    renderAt('/institute/students/view');
    expect(await screen.findByRole('heading', { name: /students/i }, FIND)).toBeInTheDocument();
  });

  it('resolves a super-admin-only module (setup / subjects)', async () => {
    seed(UserRole.SUPER_ADMIN);
    renderAt('/admin/subjects');
    expect(await screen.findByRole('heading', { name: /subjects/i }, FIND)).toBeInTheDocument();
  });

  // Admin shares the /admin shell but holds none of the reference-data or RBAC grants,
  // so the route must reject it — hiding the nav item is not access control.
  it('blocks ADMIN from the super-admin-only modules', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/subjects');
    expect(await screen.findByRole('heading', { name: /403/i }, FIND)).toBeInTheDocument();
  });

  it('blocks ADMIN from the users module', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/users');
    expect(await screen.findByRole('heading', { name: /403/i }, FIND)).toBeInTheDocument();
  });

  it('redirects a module index path to its view child', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/exams');
    expect(await screen.findByRole('heading', { name: /exams/i }, FIND)).toBeInTheDocument();
  });

  it('mounts the shared checkers module for ADMIN', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/checkers/view');
    expect(await screen.findByRole('heading', { name: /checkers/i }, FIND)).toBeInTheDocument();
  });

  it('mounts the same shared checkers module for INSTITUTE', async () => {
    seed(UserRole.INSTITUTE);
    renderAt('/institute/checkers/view');
    expect(await screen.findByRole('heading', { name: /checkers/i }, FIND)).toBeInTheDocument();
  });

  it('keeps the static /add path ahead of the dynamic /:id detail route', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/checkers/add');
    expect(await screen.findByRole('heading', { name: /add checker/i }, FIND)).toBeInTheDocument();
  });

  it('opens the shared detail page for a checker id (ADMIN)', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/checkers/chk_002');
    expect(await screen.findByText('Imran Shah', undefined, FIND)).toBeInTheDocument();
  });

  it('opens the same detail page from the institute side', async () => {
    seed(UserRole.INSTITUTE);
    renderAt('/institute/checkers/chk_003');
    expect(await screen.findByText('Sadia Rehman', undefined, FIND)).toBeInTheDocument();
  });

  // Regression: the list rows must actually navigate. A missing onRowClick typechecks
  // and renders fine, so only an interaction test catches it.
  it('opens the detail page when a checkers-list row is clicked (ADMIN)', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/checkers/view');
    fireEvent.click(await screen.findByText('Imran Shah', undefined, FIND));
    expect(await screen.findByText(/Marking Scope/i, undefined, FIND)).toBeInTheDocument();
  });

  it('opens the detail page when a checkers-list row is clicked (INSTITUTE)', async () => {
    seed(UserRole.INSTITUTE);
    renderAt('/institute/checkers/view');
    fireEvent.click(await screen.findByText('Nadia Iqbal', undefined, FIND));
    expect(await screen.findByText(/Marking Scope/i, undefined, FIND)).toBeInTheDocument();
  });

  it('opens the detail page when an approvals row is clicked', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/checkers/approvals');
    fireEvent.click(await screen.findByText('Imran Shah', undefined, FIND));
    expect(await screen.findByText(/Marking Scope/i, undefined, FIND)).toBeInTheDocument();
  });

  it('mounts the checker approvals queue for ADMIN only', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/checkers/approvals');
    expect(
      await screen.findByRole('heading', { name: /checker approvals/i }, FIND),
    ).toBeInTheDocument();
  });

  it('has no checker approvals route on the institute side', async () => {
    seed(UserRole.INSTITUTE);
    renderAt('/institute/checkers/approvals');
    expect(await screen.findByText(/not found/i, undefined, FIND)).toBeInTheDocument();
  });

  it('lists the checker’s exams at the top of My Work', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/my-work');
    expect(await screen.findByRole('heading', { name: /my work/i }, FIND)).toBeInTheDocument();
    expect(
      await screen.findByText('Class 12 Annual Examination', undefined, FIND),
    ).toBeInTheDocument();
    expect(screen.getByText('Class 10 Annual Examination')).toBeInTheDocument();
  });

  // Regression: each level's rows must actually navigate. A missing onRowClick typechecks
  // and renders fine, so only an interaction test catches it.
  it('drills exam → subject → answer → marking by clicking', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/my-work');

    fireEvent.click(await screen.findByText('Class 12 Annual Examination', undefined, FIND));
    // Subjects of that exam, and only the ones this checker holds work in.
    expect(await screen.findByText('Chemistry', undefined, FIND)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Chemistry'));
    // The subject page lists answers, tagged with the question they belong to.
    expect(await screen.findByRole('heading', { name: 'Answers' }, FIND)).toBeInTheDocument();
    const answers = await screen.findAllByText(/^anon-/, undefined, FIND);
    expect(answers.length).toBeGreaterThan(0);

    fireEvent.click(answers[0]!);
    expect(await screen.findByText(/Grade this answer/i, undefined, FIND)).toBeInTheDocument();
  });

  it('opens an answer directly by its url', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/my-work/exam_closed/sub_chem/mbatch_004_scr_001');
    expect(await screen.findByText(/Grade this answer/i, undefined, FIND)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eraser' })).toBeInTheDocument();
  });

  it('refuses an exam the checker has no work in', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/my-work/exam_draft');
    expect(
      await screen.findByRole('heading', { name: /exam not found/i }, FIND),
    ).toBeInTheDocument();
  });

  it('refuses a subject the checker has no work in', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/my-work/exam_closed/sub_math');
    expect(
      await screen.findByRole('heading', { name: /subject not found/i }, FIND),
    ).toBeInTheDocument();
  });

  it('refuses an answer belonging to another checker', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/my-work/exam_closed/sub_phy/mbatch_100_scr_001');
    expect(
      await screen.findByRole('heading', { name: /answer not found/i }, FIND),
    ).toBeInTheDocument();
  });

  // The answer is the checker's own, but reached through the wrong subject's path.
  // Without a scope check the URL would quietly lie about where the answer sits.
  it('refuses an answer reached through a mismatched url', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/my-work/exam_closed/sub_phy/mbatch_004_scr_001');
    expect(
      await screen.findByRole('heading', { name: /answer not found/i }, FIND),
    ).toBeInTheDocument();
  });

  // This one WRITES to the mock store. It uses exam_open / Biology, which no other test in
  // this file reads, so it cannot make a neighbour pass or fail depending on order.
  it('records a mark and moves on to the next answer', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/my-work/exam_open/sub_bio/mbatch_008_scr_001');
    expect(await screen.findByText(/Grade this answer/i, undefined, FIND)).toBeInTheDocument();
    expect(screen.getByText('1 of 24')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /^Correct/ }));
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    // Advanced to the next answer, and the previous band did not come with it.
    expect(await screen.findByText('2 of 24', undefined, FIND)).toBeInTheDocument();
    expect(screen.getByText('No band selected')).toBeInTheDocument();
  });

  it('mounts the evaluator history', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/history');
    expect(await screen.findByRole('heading', { name: /history/i }, FIND)).toBeInTheDocument();
  });

  // A checker's own CNIC is withheld from everyone else, but not from them.
  it('shows the checker their own profile with their identity visible', async () => {
    seed(UserRole.EVALUATOR, EVALUATOR_USER_ID);
    renderAt('/evaluator/profile');
    expect(await screen.findByText('Nadia Iqbal', undefined, FIND)).toBeInTheDocument();
    expect(screen.getByText('35202-4451209-8')).toBeInTheDocument();
  });

  it('falls through to the in-layout 404 for an unknown child path', async () => {
    seed(UserRole.ADMIN);
    renderAt('/admin/does-not-exist');
    expect(await screen.findByText(/not found/i, undefined, FIND)).toBeInTheDocument();
  });
});
