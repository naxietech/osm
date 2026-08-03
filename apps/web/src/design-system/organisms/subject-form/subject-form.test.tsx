import { type ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SubjectForm } from './subject-form';

interface RenderResult {
  onSave: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
}

function renderForm(props: Partial<ComponentProps<typeof SubjectForm>> = {}): RenderResult {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<SubjectForm open mode="create" onSave={onSave} onCancel={onCancel} {...props} />);
  return { onSave, onCancel };
}

const saveButton = (name: RegExp | string): HTMLElement => screen.getByRole('button', { name });

describe('SubjectForm', () => {
  it('opens blank for create, with saving not offered until something is typed', async () => {
    // Formik reports an untouched form as valid because validation has not run, so gating on
    // isValid alone would leave this button looking actionable while it does nothing.
    const { onSave } = renderForm();

    expect(screen.getByLabelText(/code/i)).toHaveValue('');
    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(saveButton('Add Subject')).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/code/i), 'CHEM');
    await userEvent.type(screen.getByLabelText(/name/i), 'Chemistry');

    expect(saveButton('Add Subject')).toBeEnabled();
    await userEvent.click(saveButton('Add Subject'));
    expect(onSave).toHaveBeenCalledWith({ code: 'CHEM', name: 'Chemistry' });
  });

  it('opens pre-filled for edit and will not save an unchanged subject', () => {
    renderForm({ mode: 'edit', initialValue: { code: 'PHY', name: 'Physics' } });

    expect(screen.getByLabelText(/code/i)).toHaveValue('PHY');
    expect(screen.getByLabelText(/name/i)).toHaveValue('Physics');
    // Nothing has changed, so there is nothing worth a write.
    expect(saveButton('Save Changes')).toBeDisabled();
  });

  it('emits trimmed values', async () => {
    const { onSave } = renderForm();

    await userEvent.type(screen.getByLabelText(/code/i), '  BIO  ');
    await userEvent.type(screen.getByLabelText(/name/i), '  Biology  ');
    await userEvent.click(saveButton('Add Subject'));

    expect(onSave).toHaveBeenCalledWith({ code: 'BIO', name: 'Biology' });
  });

  it('refuses a code the API would reject, without calling onSave', async () => {
    const { onSave } = renderForm();

    await userEvent.type(screen.getByLabelText(/code/i), 'PH Y');
    await userEvent.type(screen.getByLabelText(/name/i), 'Physics');
    await userEvent.click(saveButton('Add Subject'));

    expect(await screen.findByText(/letters, numbers, dashes and underscores only/i)).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reports a name past the API limit rather than sending it', async () => {
    const { onSave } = renderForm();

    await userEvent.type(screen.getByLabelText(/code/i), 'LONG');
    await userEvent.type(screen.getByLabelText(/name/i), 'A'.repeat(101));
    await userEvent.click(saveButton('Add Subject'));

    expect(await screen.findByText(/at most 100 characters/i)).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels without saving', async () => {
    const { onSave, onCancel } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('locks the dialog while a save is in flight', () => {
    renderForm({ isSaving: true, initialValue: { code: 'PHY', name: 'Physics' }, mode: 'edit' });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
