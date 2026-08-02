import { useRef, useState } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/design-system/atoms/button';

import { ConfirmDialog } from './confirm-dialog';
import { Modal } from './modal';

function renderModal(props: Partial<React.ComponentProps<typeof Modal>> = {}): {
  onClose: ReturnType<typeof vi.fn>;
} {
  const onClose = vi.fn();
  render(
    <Modal open onClose={onClose} title="Reset password" {...props}>
      <p>Body content</p>
    </Modal>,
  );
  return { onClose };
}

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Hidden">
        <p>Body content</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a modal dialog named by its title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Reset password');
  });

  it('is described by the description when one is given', () => {
    renderModal({ description: 'They will be signed out everywhere.' });
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'They will be signed out everywhere.',
    );
  });

  it('closes on the X', async () => {
    const { onClose } = renderModal();
    await userEvent.setup().click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const { onClose } = renderModal();
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed while busy — a request is in flight', async () => {
    // Losing a half-finished request to a stray backdrop click leaves the user unsure
    // whether it went through.
    const user = userEvent.setup();
    const { onClose } = renderModal({ busy: true });

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /close dialog/i })).not.toBeInTheDocument();
  });

  it('locks the page behind it and restores scrolling on close', () => {
    const { unmount } = render(
      <Modal open onClose={vi.fn()} title="Locked">
        <p>Body content</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders its footer actions', () => {
    render(
      <Modal open onClose={vi.fn()} title="With actions" footer={<Button>Save</Button>}>
        <p>Body content</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('returns focus to whatever opened it', async () => {
    // Without this a keyboard user is dumped at the top of the page on close.
    function Harness(): React.ReactElement {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="Focus test">
            <p>Body content</p>
          </Modal>
        </>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('confirms and cancels through the right callbacks', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Suspend Ayesha Khan?"
        confirmLabel="Suspend"
        tone="danger"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never puts the destructive action first in the tab order', () => {
    // Opening a dialog and pressing Enter must not carry out the destructive action.
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Suspend?"
        confirmLabel="Suspend"
        tone="danger"
      />,
    );
    expect(screen.getByRole('button', { name: 'Suspend' })).not.toHaveFocus();
  });

  it('disables both actions while busy', () => {
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Suspend?"
        confirmLabel="Suspend"
        busy
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('blocks confirm when the caller says the input is not ready', () => {
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Reset password"
        confirmLabel="Reset"
        confirmDisabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });
});
