import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InstituteRegistrationPage } from './institute-registration.page';

const CATEGORY = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'SCH',
  name: 'School',
  isActive: true,
  version: 1,
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
    render(<InstituteRegistrationPage />);

    expect(screen.getByLabelText(/Institute Code/i)).toBeInTheDocument();
    // The rest of the form is not on screen yet — that is the whole point of the gate.
    expect(screen.queryByLabelText(/Address/i)).not.toBeInTheDocument();
  });

  it('checks both fields in one request rather than one per field', async () => {
    const fetchMock = mockApi();
    render(<InstituteRegistrationPage />);
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
    render(<InstituteRegistrationPage />);
    await passTheGate();

    expect(await screen.findByText(/already registered with that code/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Address/i)).not.toBeInTheDocument();
  });

  it('stops at the gate when the email already has an account', async () => {
    mockApi({ availability: { codeAvailable: true, emailAvailable: false } });
    render(<InstituteRegistrationPage />);
    await passTheGate();

    expect(await screen.findByText(/already has an account/i)).toBeInTheDocument();
  });

  it('opens the rest of the form once both are free', async () => {
    mockApi();
    render(<InstituteRegistrationPage />);
    await passTheGate();

    expect(await screen.findByLabelText(/Address/i)).toBeInTheDocument();
  });

  it('keeps what was typed across a refresh', async () => {
    // The single worst thing that can happen to someone filling in a long form.
    mockApi();
    const first = render(<InstituteRegistrationPage />);
    await userEvent.type(screen.getByLabelText(/Institute Code/i), 'S01');
    first.unmount();

    render(<InstituteRegistrationPage />);
    expect(screen.getByLabelText(/Institute Code/i)).toHaveValue('S01');
  });

  it("shows the server's own wording when the submission is refused", async () => {
    // The gate passed, but the code was taken in the meantime. The page must show what the
    // server said rather than restating a rule of its own, which is how UI copy goes stale.
    mockApi({
      registerResponse: failure(409, 'An institute is already registered with that code.'),
    });
    render(<InstituteRegistrationPage />);
    await passTheGate();
    await screen.findByLabelText(/Address/i);
    await completeAndSubmit();

    expect(await screen.findByText(/already registered with that code/i)).toBeInTheDocument();
  });

  it('names the institute code on the confirmation, since nothing can be emailed', async () => {
    mockApi();
    render(<InstituteRegistrationPage />);
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
    render(<InstituteRegistrationPage />);
    await passTheGate();
    await screen.findByLabelText(/Address/i);
    await completeAndSubmit();

    await screen.findByText(/Registration received/i);
    expect(window.sessionStorage.getItem('oses.institute-registration.v1')).toBeNull();
  });
});
