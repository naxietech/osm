import { MemoryRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type AcademicClass, UserRole } from '@oses/types';

import { AuthProvider } from '@/hooks/use-auth';

import { ClassesPage } from './classes.page';

/** Whoever is signed in while these tests run — the page only fetches when someone is. */
const SIGNED_IN = {
  id: 'usr_admin',
  email: 'admin@oses.pk',
  role: UserRole.SUPER_ADMIN,
  roleId: 'role_super_admin',
  fullName: 'Super Admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SCIENCE_ID = '22222222-2222-4222-8222-222222222222';
const BIOLOGY_ID = '33333333-3333-4333-8333-333333333333';

const CLASS_9: AcademicClass = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Class 9',
  ordinal: 9,
  description: 'Secondary — SSC Part I',
  isActive: true,
  version: 3,
  groups: [
    {
      id: SCIENCE_ID,
      name: 'Science',
      isActive: true,
      subgroups: [{ id: BIOLOGY_ID, name: 'Biology', isActive: true }],
    },
  ],
};

const INACTIVE_CLASS: AcademicClass = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Class 12',
  ordinal: 12,
  isActive: false,
  version: 1,
  groups: [],
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
  classes?: AcademicClass[];
  /** What GET /classes answers with, when the list itself should fail. */
  listResponse?: Response;
  /** What a write to /classes answers with. Defaults to success. */
  writeResponse?: Response;
  /**
   * What GET /classes answers with from the SECOND call onward — for simulating someone else
   * saving while a form is open on this screen.
   */
  classesAfterRefetch?: AcademicClass[];
  /** Leave writes pending forever, so an in-flight state can be inspected. */
  holdWrites?: boolean;
}

/** Every write the page made, in order, so a test can assert on the request body. */
interface Write {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

function mockApi(options: MockOptions = {}): Write[] {
  const writes: Write[] = [];
  const classes = options.classes ?? [CLASS_9];
  let listCalls = 0;

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // Must come first: the list waits on a session.
    if (url.includes('/auth/me')) return Promise.resolve(envelope(SIGNED_IN));
    if (url.includes('/auth/permissions')) return Promise.resolve(envelope([]));

    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({
        url,
        method,
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      });
      if (options.holdWrites) return new Promise<Response>(() => {});
      return Promise.resolve(options.writeResponse ?? envelope(classes[0] ?? CLASS_9));
    }

    if (url.includes('/classes')) {
      listCalls += 1;
      if (options.listResponse) return Promise.resolve(options.listResponse);
      const body =
        listCalls > 1 && options.classesAfterRefetch ? options.classesAfterRefetch : classes;
      return Promise.resolve(envelope(body));
    }
    return Promise.resolve(failure(404, 'Not found'));
  });

  vi.stubGlobal('fetch', fetchMock);
  return writes;
}

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/classes']}>
        <AuthProvider>
          <ClassesPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The table row for a given class. */
async function rowFor(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name);
  const row = cell.closest('tr');
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ClassesPage', () => {
  describe('the list', () => {
    it('shows each class with its order and group count', async () => {
      mockApi();
      renderPage();

      const row = await rowFor('Class 9');
      expect(within(row).getByText('9')).toBeInTheDocument();
      expect(within(row).getByText('Secondary — SSC Part I')).toBeInTheDocument();
      // One group, counted from the tree the list already carries.
      expect(within(row).getByText('1')).toBeInTheDocument();
    });

    it('shows deactivated classes too, or one could never be activated again', async () => {
      mockApi({ classes: [CLASS_9, INACTIVE_CLASS] });
      renderPage();

      const row = await rowFor('Class 12');
      expect(within(row).getByRole('button', { name: 'Activate class' })).toBeInTheDocument();
    });

    it("shows the server's message when the list cannot be read", async () => {
      mockApi({ listResponse: failure(403, 'Missing levels.manage grant') });
      renderPage();

      expect(await screen.findByRole('alert')).toHaveTextContent('Missing levels.manage grant');
    });

    it('does not claim there are no classes when the list simply failed to load', async () => {
      mockApi({ listResponse: failure(500, 'Something broke') });
      renderPage();

      await screen.findByRole('alert');

      // "No classes yet" under an error banner reads as "the list is empty", and an admin who
      // believes it adds a class that already exists.
      expect(screen.queryByText('No classes yet')).not.toBeInTheDocument();
    });
  });

  describe('expanding a row', () => {
    it('reveals the group and subgroup tree, and hides it again', async () => {
      mockApi();
      renderPage();
      const row = await rowFor('Class 9');

      // Collapsed to begin with — the list is a list.
      expect(screen.queryByText('Biology')).not.toBeInTheDocument();

      await userEvent.click(row);

      expect(screen.getByText('Science')).toBeInTheDocument();
      expect(screen.getByText('Biology')).toBeInTheDocument();
      expect(row).toHaveAttribute('aria-expanded', 'true');

      await userEvent.click(row);

      expect(screen.queryByText('Biology')).not.toBeInTheDocument();
      expect(row).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens the tree rather than the edit form', async () => {
      mockApi();
      renderPage();
      const row = await rowFor('Class 9');

      await userEvent.click(row);

      // Clicking a row used to open the editor. One click target, one action.
      expect(screen.queryByLabelText(/Class Name/i)).not.toBeInTheDocument();
      expect(screen.getByText('Science')).toBeInTheDocument();
    });

    it('leaves a class with no groups inert — there is nothing to reveal', async () => {
      mockApi({ classes: [INACTIVE_CLASS] });
      renderPage();
      const row = await rowFor('Class 12');

      expect(row).not.toHaveAttribute('aria-expanded');

      await userEvent.click(row);

      expect(screen.queryByLabelText(/Class Name/i)).not.toBeInTheDocument();
    });

    it('opens the editor from the Edit button by keyboard, without toggling the row', async () => {
      mockApi();
      renderPage();
      const row = await rowFor('Class 9');

      within(row).getByRole('button', { name: 'Edit class' }).focus();
      await userEvent.keyboard('{Enter}');

      // The row is itself a button for expanding, so a keypress on a button inside it bubbles
      // up. Mouse clicks were always fine here; only the keyboard path broke.
      expect(screen.getByLabelText(/Class Name/i)).toHaveValue('Class 9');
      expect(row).toHaveAttribute('aria-expanded', 'false');
    });

    it('still opens the editor from the Edit button', async () => {
      mockApi();
      renderPage();
      const row = await rowFor('Class 9');

      await userEvent.click(within(row).getByRole('button', { name: 'Edit class' }));

      expect(screen.getByLabelText(/Class Name/i)).toHaveValue('Class 9');
    });
  });

  describe('adding a class', () => {
    it('sends the class and its tree in one POST', async () => {
      const writes = mockApi();
      renderPage();
      await rowFor('Class 9');

      await userEvent.click(screen.getByRole('button', { name: 'Add Class' }));
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 10' } });
      fireEvent.change(screen.getByLabelText(/Order/i), { target: { value: '10' } });
      await userEvent.click(screen.getByLabelText(/Has group/i));
      fireEvent.change(screen.getByLabelText(/Group 1 name/i), { target: { value: 'Commerce' } });

      const submit = screen.getAllByRole('button', { name: 'Add Class' }).at(-1) as HTMLElement;
      await waitFor(() => expect(submit).toBeEnabled());
      await userEvent.click(submit);

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]).toMatchObject({
        method: 'POST',
        body: {
          name: 'Class 10',
          ordinal: 10,
          groups: [{ name: 'Commerce', subgroups: [] }],
        },
      });
    });

    it('keeps the form open and shows why when the server refuses', async () => {
      mockApi({ writeResponse: failure(409, 'A class named "Class 10" already exists') });
      renderPage();
      await rowFor('Class 9');

      await userEvent.click(screen.getByRole('button', { name: 'Add Class' }));
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 10' } });
      fireEvent.change(screen.getByLabelText(/Order/i), { target: { value: '10' } });

      const submit = screen.getAllByRole('button', { name: 'Add Class' }).at(-1) as HTMLElement;
      await waitFor(() => expect(submit).toBeEnabled());
      await userEvent.click(submit);

      // The API's own wording, not a restatement — and the typed values are still there.
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A class named "Class 10" already exists',
      );
      expect(screen.getByLabelText(/Class Name/i)).toHaveValue('Class 10');
    });
  });

  describe('editing a class', () => {
    it('opens the form already showing the saved tree', async () => {
      mockApi();
      renderPage();
      const row = await rowFor('Class 9');

      await userEvent.click(within(row).getByRole('button', { name: 'Edit class' }));

      expect(screen.getByLabelText(/Class Name/i)).toHaveValue('Class 9');
      expect(screen.getByLabelText(/Order/i)).toHaveValue(9);
      expect(screen.getByLabelText(/Group 1 name/i)).toHaveValue('Science');
      expect(screen.getByLabelText(/Group 1 subgroup 1/i)).toHaveValue('Biology');
    });

    it('sends the loaded version and preserves ids, so nothing is orphaned', async () => {
      const writes = mockApi();
      renderPage();
      const row = await rowFor('Class 9');

      await userEvent.click(within(row).getByRole('button', { name: 'Edit class' }));
      fireEvent.change(screen.getByLabelText(/Group 1 name/i), { target: { value: 'Sciences' } });

      const save = screen.getByRole('button', { name: 'Save Changes' });
      await waitFor(() => expect(save).toBeEnabled());
      await userEvent.click(save);

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]).toMatchObject({
        method: 'PATCH',
        body: {
          version: 3,
          name: 'Class 9',
          ordinal: 9,
          groups: [
            { id: SCIENCE_ID, name: 'Sciences', subgroups: [{ id: BIOLOGY_ID, name: 'Biology' }] },
          ],
        },
      });
    });

    it('sends the version the draft was built from, not a fresher one', async () => {
      // Someone else saves Class 9 while this admin has it open: the next refetch brings back
      // version 4. The open draft is still the version-3 one, so version 3 is what must go up
      // — sending 4 would sail past the server's conflict check and quietly overwrite them.
      const writes = mockApi({
        classes: [CLASS_9, INACTIVE_CLASS],
        classesAfterRefetch: [{ ...CLASS_9, name: 'Renamed By Someone Else', version: 4 }],
      });
      renderPage();

      const nine = await rowFor('Class 9');
      await userEvent.click(within(nine).getByRole('button', { name: 'Edit class' }));

      // Any mutation invalidates the list; restoring the other class is the cheapest one.
      const twelve = await rowFor('Class 12');
      await userEvent.click(within(twelve).getByRole('button', { name: 'Activate class' }));
      await waitFor(() => expect(writes).toHaveLength(1));
      await screen.findByText('Renamed By Someone Else');

      const save = screen.getByRole('button', { name: 'Save Changes' });
      await waitFor(() => expect(save).toBeEnabled());
      await userEvent.click(save);

      await waitFor(() => expect(writes).toHaveLength(2));
      expect(writes[1]?.body).toMatchObject({ version: 3 });
    });

    it('clears the description as null, so the column can actually be emptied', async () => {
      const writes = mockApi();
      renderPage();
      const row = await rowFor('Class 9');

      await userEvent.click(within(row).getByRole('button', { name: 'Edit class' }));
      fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: '' } });

      const save = screen.getByRole('button', { name: 'Save Changes' });
      await waitFor(() => expect(save).toBeEnabled());
      await userEvent.click(save);

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.body).toMatchObject({ description: null });
    });
  });

  describe('deactivating a class', () => {
    it('asks first, then sends an explicit target state', async () => {
      const writes = mockApi();
      renderPage();
      const row = await rowFor('Class 9');

      await userEvent.click(within(row).getByRole('button', { name: 'Deactivate class' }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Deactivate Class 9?');
      expect(writes).toHaveLength(0);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]).toMatchObject({ method: 'PATCH', body: { isActive: false } });
      expect(writes[0]?.url).toContain('/status');
    });

    it('spins only the row being changed, not every row', async () => {
      const second = { ...INACTIVE_CLASS, id: 'second-inactive-id', name: 'Class 11', ordinal: 11 };
      mockApi({ classes: [INACTIVE_CLASS, second], holdWrites: true });
      renderPage();

      const twelve = await rowFor('Class 12');
      await userEvent.click(within(twelve).getByRole('button', { name: 'Activate class' }));

      // Every row shares one mutation, so a naive `isPending` would light up both.
      const eleven = await rowFor('Class 11');
      await waitFor(() =>
        expect(within(twelve).getByRole('button', { name: 'Activate class' })).toHaveAttribute(
          'aria-busy',
          'true',
        ),
      );
      expect(within(eleven).getByRole('button', { name: 'Activate class' })).not.toHaveAttribute(
        'aria-busy',
      );
    });

    it('activates without a confirmation — it is not the destructive direction', async () => {
      const writes = mockApi({ classes: [INACTIVE_CLASS] });
      renderPage();
      const row = await rowFor('Class 12');

      await userEvent.click(within(row).getByRole('button', { name: 'Activate class' }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]).toMatchObject({ body: { isActive: true } });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
