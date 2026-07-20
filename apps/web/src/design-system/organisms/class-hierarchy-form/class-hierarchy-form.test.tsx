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

  it('requires a non-empty group name when "Has group?" is ticked', async () => {
    render(<ClassHierarchyForm {...baseProps} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Class Name/i), { target: { value: 'Class 9' } });
    fireEvent.click(screen.getByLabelText(/Has group/i));

    expect(await screen.findByText(/Group name is required/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Class' })).toBeDisabled());
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
});
