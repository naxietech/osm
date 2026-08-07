import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderResult, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InstituteRegistrationPage } from './institute-registration.page';

/**
 * A fresh client per render, which is what a real page load is. It matters for the two refresh
 * tests below: they unmount and render again, and a shared cache would answer the second mount
 * from the first one's memory instead of going back to the network the way a reload does.
 *
 * Retries off so a deliberately-failing request fails once, not four times.
 */
function renderPage(): RenderResult {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InstituteRegistrationPage />
    </QueryClientProvider>,
  );
}

/**
 * Exactly what `GET /public/institute-categories` sends — no `isActive`, no `version`. Keeping
 * those in the fixture is what hid the bug: the page filtered on `isActive`, the fixture had
 * one, and the test passed while every real category was being dropped.
 */
const CATEGORY = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'SCH',
  name: 'School',
  questions: [],
};

function envelope(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), {
    status,
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
  availability?: { codeAvailable: boolean | null; emailAvailable: boolean | null };
  registerResponse?: Response;
}

function mockApi(options: MockOptions = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/public/institute-categories')) return Promise.resolve(envelope([CATEGORY]));
    if (url.includes('/check-availability')) {
      return Promise.resolve(
        envelope(options.availability ?? { codeAvailable: true, emailAvailable: true }),
      );
    }
    if (url.includes('/public/institutes') && init?.method === 'POST') {
      return Promise.resolve(
        options.registerResponse ??
          envelope(
            {
              id: 'i1',
              instituteCode: 'S01',
              instituteName: 'Govt High School',
              status: 'pending',
            },
            201,
          ),
      );
    }
    return Promise.resolve(failure(404, 'Not found'));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Fills every remaining required field and submits. */
async function completeAndSubmit(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/Institute Name/i), 'Govt High School');
  await userEvent.click(screen.getByLabelText(/Institute Category/i));
  await userEvent.click(await screen.findByRole('option', { name: 'School' }));
  await userEvent.click(screen.getByLabelText(/^Type/i));
  await userEvent.click(await screen.findByRole('option', { name: 'Government' }));
  await userEvent.type(screen.getByLabelText(/Address/i), '1 Mall Road');
  await userEvent.click(screen.getByLabelText(/Province/i));
  await userEvent.click(await screen.findByRole('option', { name: 'Punjab' }));
  await userEvent.type(screen.getByLabelText(/^City/i), 'Lahore');
  await userEvent.type(screen.getByLabelText(/Contact Name/i), 'Ayesha Khan');
  await userEvent.type(screen.getByLabelText(/Designation/i), 'Principal');
  await userEvent.type(screen.getByLabelText(/Contact No/i), '+92-42-1234567');
  await userEvent.type(screen.getByLabelText(/^Password/i), 'a-strong-password');
  await userEvent.type(screen.getByLabelText(/Confirm Password/i), 'a-strong-password');
  await userEvent.click(screen.getByRole('button', { name: /Submit Registration/i }));
}

/** Fill the two gate fields and press Continue. */
async function passTheGate(code = 'S01', email = 'principal@example.pk'): Promise<void> {
  await userEvent.type(screen.getByLabelText(/Institute Code/i), code);
  await userEvent.type(screen.getByLabelText(/Contact Email/i), email);
  await userEvent.click(screen.getByRole('button', { name: /Continue/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe('InstituteRegistrationPage', () => {
  it('asks for the code and email before the long form', () => {
    mockApi();
    renderPage();

    expect(screen.getByLabelText(/Institute Code/i)).toBeInTheDocument();
    // The rest of the form is not on screen yet — that is the whole point of the gate.
    expect(screen.queryByLabelText(/Address/i)).not.toBeInTheDocument();
  });

  it('checks both fields in one request rather than one per field', async () => {
    const fetchMock = mockApi();
    renderPage();
    await passTheGate();

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([url]) => String(url).includes('availability'));
      expect(calls).toHaveLength(1);
      expect(JSON.parse(String((calls[0]![1] as RequestInit).body))).toEqual({
        instituteCode: 'S01',
        contactEmail: 'principal@example.pk',
      });
    });
  });

  it('stops at the gate when the code is taken, before anything long is filled in', async () => {
    mockApi({ availability: { codeAvailable: false, emailAvailable: true } });
    renderPage();
    await passTheGate();

    expect(await screen.findByText(/already registered with that code/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Address/i)).not.toBeInTheDocument();
  });

  it('stops at the gate when the email already has an account', async () => {
    mockApi({ availability: { codeAvailable: true, emailAvailable: false } });
    renderPage();
    await passTheGate();

    expect(await screen.findByText(/already has an account/i)).toBeInTheDocument();
  });

  it('opens the rest of the form once both are free', async () => {
    mockApi();
    renderPage();
    await passTheGate();

    expect(await screen.findByLabelText(/Address/i)).toBeInTheDocument();
  });

  it('keeps the gate fields across a refresh', async () => {
    mockApi();
    const first = renderPage();
    await userEvent.type(screen.getByLabelText(/Institute Code/i), 'S01');
    first.unmount();

    renderPage();
    expect(screen.getByLabelText(/Institute Code/i)).toHaveValue('S01');
  });

  it('keeps the LONG form across a refresh — the fifteen fields, not just the gate', async () => {
    // The earlier version of this test typed into the gate field and passed while covering
    // none of the actual risk. This one fills the long form, which is what an applicant
    // would lose.
    mockApi();
    const first = renderPage();
    await passTheGate();
    await screen.findByLabelText(/Address/i);

    await userEvent.type(screen.getByLabelText(/Institute Name/i), 'Govt High School');
    await userEvent.type(screen.getByLabelText(/Address/i), '1 Mall Road');
    await userEvent.type(screen.getByLabelText(/^City/i), 'Lahore');
    await userEvent.type(screen.getByLabelText(/Contact Name/i), 'Ayesha Khan');
    first.unmount();

    // No second trip through the gate: a refresh lands back on the step the applicant was on.
    // Before this, it dropped them to step one with all fifteen fields saved but unreachable —
    // the exact loss this persistence exists to prevent, undone at the last moment.
    renderPage();
    expect(await screen.findByLabelText(/Institute Name/i)).toHaveValue('Govt High School');
    expect(screen.getByLabelText(/Address/i)).toHaveValue('1 Mall Road');
    expect(screen.getByLabelText(/^City/i)).toHaveValue('Lahore');
    expect(screen.getByLabelText(/Contact Name/i)).toHaveValue('Ayesha Khan');
  });

  it('stays on step two across a refresh', async () => {
    mockApi();
    const first = renderPage();
    await passTheGate();
    await screen.findByLabelText(/Address/i);
    first.unmount();

    renderPage();

    expect(await screen.findByLabelText(/Address/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check and continue/i })).not.toBeInTheDocument();
  });

  it('offers the categories the public route returned', async () => {
    // The route sends only active categories and omits `isActive` entirely. Filtering the list
    // on that field dropped every one of them and left this dropdown empty.
    mockApi();
    renderPage();
    await passTheGate();

    // A custom combobox, so the options exist only once it is open.
    await userEvent.click(await screen.findByRole('combobox', { name: /Category/i }));
    expect(await screen.findByRole('option', { name: 'School' })).toBeInTheDocument();
  });

  it('never persists the password', async () => {
    // A chosen password in browser storage is a real exposure on a shared machine. The draft
    // type excludes it by construction, so this asserts the guarantee rather than the habit.
    mockApi();
    renderPage();
    await passTheGate();
    await screen.findByLabelText(/Address/i);
    await userEvent.type(screen.getByLabelText(/^Password/i), 'a-strong-password');

    const stored = JSON.stringify(window.sessionStorage);
    expect(stored).not.toContain('a-strong-password');
  });

  it("shows the server's own wording when the submission is refused", async () => {
    // The gate passed, but the code was taken in the meantime. The page must show what the
    // server said rather than restating a rule of its own, which is how UI copy goes stale.
    mockApi({
      registerResponse: failure(409, 'An institute is already registered with that code.'),
    });
    renderPage();
    await passTheGate();
    await screen.findByLabelText(/Address/i);
    await completeAndSubmit();

    expect(await screen.findByText(/already registered with that code/i)).toBeInTheDocument();
  });

  it('names the institute code on the confirmation, since nothing can be emailed', async () => {
    mockApi();
    renderPage();
    await passTheGate();
    await screen.findByLabelText(/Address/i);
    await completeAndSubmit();

    expect(await screen.findByText(/Registration received/i)).toBeInTheDocument();
    expect(screen.getByText('S01')).toBeInTheDocument();
    expect(screen.getByText(/Quote your institute code/i)).toBeInTheDocument();
  });

  it('forgets the draft once it has been submitted', async () => {
    // It holds the password they just chose. Nothing keeps it after it has done its job.
    mockApi();
    renderPage();
    await passTheGate();
    await screen.findByLabelText(/Address/i);
    await completeAndSubmit();

    await screen.findByText(/Registration received/i);
    expect(window.sessionStorage.getItem('oses.institute-registration.v1')).toBeNull();
  });
});
