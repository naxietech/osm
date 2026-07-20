import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SloForm, type SloFormValue } from './slo-form';

const classOptions = [{ value: 'lvl_9', label: 'Class 9' }];
const subjectOptions = [{ value: 'sub_bio', label: 'Biology' }];

const baseProps = {
  mode: 'create' as const,
  classOptions,
  subjectOptions,
  isCodeTaken: () => false,
  suggestCode: () => '',
  onCancel: vi.fn(),
};

/** A create form pre-pointed at a class + subject (as the page does). */
const linked: SloFormValue = {
  classId: 'lvl_9',
  subjectId: 'sub_bio',
  code: '',
  name: '',
  description: '',
};

// Formik validates asynchronously, so validity-driven assertions are awaited.
describe('SloForm', () => {
  it('renders the fields and disables save until code + name are filled', async () => {
    render(<SloForm {...baseProps} onSave={vi.fn()} initialValue={linked} />);
    expect(screen.getByLabelText(/Code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add SLO' })).toBeDisabled());
  });

  it('flags a duplicate code', async () => {
    render(
      <SloForm
        {...baseProps}
        onSave={vi.fn()}
        initialValue={linked}
        isCodeTaken={(_c, _s, code) => code.trim().toUpperCase() === '9-BIO-1.1'}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Code/i), { target: { value: '9-BIO-1.1' } });
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add SLO' })).toBeDisabled();
  });

  it('fills the code from the Suggest button', async () => {
    render(
      <SloForm
        {...baseProps}
        onSave={vi.fn()}
        initialValue={linked}
        suggestCode={() => '9-BIO-1.3'}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Suggest code/i }));
    await waitFor(() => expect(screen.getByLabelText(/Code/i)).toHaveValue('9-BIO-1.3'));
  });

  it('emits the trimmed value on save', async () => {
    const onSave = vi.fn();
    render(<SloForm {...baseProps} onSave={onSave} initialValue={linked} />);
    fireEvent.change(screen.getByLabelText(/Code/i), { target: { value: '9-BIO-2.1' } });
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: '  Photosynthesis  ' } });

    const save = screen.getByRole('button', { name: 'Add SLO' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      classId: 'lvl_9',
      subjectId: 'sub_bio',
      code: '9-BIO-2.1',
      name: 'Photosynthesis',
    });
  });
});
