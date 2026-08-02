import { type ReactNode } from 'react';

import { Button } from '@/design-system/atoms/button';

import { Modal } from './modal';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** What is about to happen — including any consequence the user can't undo. */
  description?: string;
  /** Extra detail: a warning, a form field, whatever the decision needs. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for destructive actions; anything else uses the primary button. */
  tone?: 'danger' | 'primary';
  /** Request in flight: buttons disable, confirm spins, and the dialog can't be dismissed. */
  busy?: boolean;
  /** Blocks confirm — e.g. a required field in `children` is empty or invalid. */
  confirmDisabled?: boolean;
}

/**
 * Confirmation dialog for an action worth pausing on — destructive, or with a
 * consequence beyond the obvious (signing someone out of every device, say).
 *
 * Confirm is never the first focusable element: the trap lands on the header's close
 * button, so opening a dialog and hitting Enter dismisses it rather than carrying out the
 * destructive action. Cancel also precedes Confirm in the DOM, which puts Cancel on the
 * left on desktop (`sm:flex-row`) and Confirm on top when the row stacks on mobile
 * (`flex-col-reverse`) — the primary action nearest the thumb.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  confirmDisabled = false,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={busy}
            disabled={busy || confirmDisabled}
            className="w-full sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export default ConfirmDialog;
