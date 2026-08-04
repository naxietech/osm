import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClassHierarchyForm, type ClassHierarchyValue } from './class-hierarchy-form';

const baseProps = {
  mode: 'create' as const,
  onCancel: vi.fn(),
};

// Formik validates asynchronously, so validity-driven assertions are awaited.
describe('ClassHierarchyForm', () => {
  it('renders the class name and disables save until it is filled', async () => {
    render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/Class Name/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Class' })).toBeDisabled());
  });

  describe('a group name is required, but not complained about on sight', () => {
    it('shows no error on the row that ticking "Has group?" just created', async () => {
      render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });
      fireEvent.change(screen.getByLabelText(/Order/i), { target: { value: '9' } });
      fireEvent.click(screen.getByLabelText(/Has group/i));

      // The field appears empty because the user just asked for it. Marking it red before
      // they have typed anything scolds them for a box they requested one click ago.
      expect(await screen.findByLabelText(/Group 1 name/i)).toBeInTheDocument();
      expect(screen.queryByText(/Group name is required/i)).not.toBeInTheDocument();

      // Still not saveable, though — the rule itself is unchanged.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Add Class' })).toBeDisabled());
    });

    it('shows the error once the field has been left empty', async () => {
      render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });
      fireEvent.click(screen.getByLabelText(/Has group/i));

      fireEvent.blur(await screen.findByLabelText(/Group 1 name/i));

      expect(await screen.findByText(/Group name is required/i)).toBeInTheDocument();
    });

    it('shows the error once a typed name is cleared again', async () => {
      render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });
      fireEvent.click(screen.getByLabelText(/Has group/i));

      const field = await screen.findByLabelText(/Group 1 name/i);
      fireEvent.change(field, { target: { value: 'Science' } });
      fireEvent.change(field, { target: { value: '' } });

      expect(await screen.findByText(/Group name is required/i)).toBeInTheDocument();
    });

    it('flags a duplicate name as soon as it is typed', async () => {
      render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });
      fireEvent.click(screen.getByLabelText(/Has group/i));
      fireEvent.change(await screen.findByLabelText(/Group 1 name/i), {
        target: { value: 'Science' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Add Group/i }));
      fireEvent.change(await screen.findByLabelText(/Group 2 name/i), {
        target: { value: 'Science' },
      });

      // Typing counts as touching, so a real clash is reported immediately — the delay only
      // ever applies to "this is empty". Both rows are flagged, since either one could be the
      // one to rename.
      expect(await screen.findAllByText(/Group name must be unique/i)).toHaveLength(2);
    });
  });

  it('does not flag a freshly added subgroup either', async () => {
    render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });
    fireEvent.click(screen.getByLabelText(/Has group/i));
    fireEvent.change(await screen.findByLabelText(/Group 1 name/i), {
      target: { value: 'Science' },
    });
    fireEvent.click(screen.getByLabelText(/Has subgroup/i));

    expect(await screen.findByLabelText(/Group 1 subgroup 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Subgroup name is required/i)).not.toBeInTheDocument();
  });

  it('preserves existing group/subgroup ids on save (no orphaned references)', async () => {
    const onSave = vi.fn();
    const initialValue: ClassHierarchyValue = {
      name: 'Class 9',
      ordinal: '9',
      description: '',
      groups: [{ id: 'cg_1', name: 'Science', subgroups: [{ id: 'sg_1', name: 'Biology' }] }],
    };
    render(
      <ClassHierarchyForm {...baseProps} mode="edit" initialValue={initialValue} onSave={onSave} />,
    );

    const save = screen.getByRole('button', { name: 'Save Changes' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const value = onSave.mock.calls[0]?.[0] as ClassHierarchyValue | undefined;
    expect(value?.groups).toEqual([
      { id: 'cg_1', name: 'Science', subgroups: [{ id: 'sg_1', name: 'Biology' }] },
    ]);
  });

  describe('order', () => {
    it('will not save without one — the class list is sorted by it', async () => {
      render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });

      await waitFor(() => expect(screen.getByRole('button', { name: 'Add Class' })).toBeDisabled());
    });

    it('enables save once a valid order is given', async () => {
      render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });
      fireEvent.change(screen.getByLabelText(/Order/i), { target: { value: '9' } });

      await waitFor(() => expect(screen.getByRole('button', { name: 'Add Class' })).toBeEnabled());
    });

    it('refuses a value the API would reject anyway', async () => {
      render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });
      const order = screen.getByLabelText(/Order/i);
      fireEvent.change(order, { target: { value: '100' } });
      fireEvent.blur(order);

      expect(await screen.findByText(/between 1 and 99/i)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Add Class' })).toBeDisabled());
    });
  });

  describe('while a save is in flight', () => {
    const filled: ClassHierarchyValue = {
      name: 'Class 9',
      ordinal: '9',
      description: '',
      groups: [],
    };

    it('locks both buttons, so one click cannot become two saves', async () => {
      render(
        <ClassHierarchyForm
          {...baseProps}
          mode="edit"
          initialValue={filled}
          onSave={vi.fn()}
          submitting
        />,
      );

      // Matched loosely: the spinner contributes "Loading" to the accessible name.
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Save Changes/ })).toBeDisabled(),
      );
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it("shows the server's own words when the save failed", () => {
      render(
        <ClassHierarchyForm
          {...baseProps}
          mode="edit"
          initialValue={filled}
          onSave={vi.fn()}
          error='A class named "Class 9" already exists'
        />,
      );

      // Passed straight through rather than restated, so the UI cannot drift from the API's
      // actual rules.
      expect(screen.getByRole('alert')).toHaveTextContent('A class named "Class 9" already exists');
    });
  });
});
