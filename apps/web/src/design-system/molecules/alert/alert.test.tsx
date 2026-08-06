import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Alert } from './alert';

describe('Alert', () => {
  it('announces a success politely via role="status"', () => {
    render(<Alert>Saved.</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  });

  it('interrupts for a danger tone via role="alert"', () => {
    render(<Alert tone="danger">Login failed.</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Login failed.');
  });

  it('shows the icon badge for success and omits it for danger by default', () => {
    const { container, rerender } = render(<Alert>Done</Alert>);
    expect(container.querySelector('svg')).not.toBeNull();

    rerender(<Alert tone="danger">Nope</Alert>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('lets a caller drop the icon explicitly', () => {
    const { container } = render(<Alert withIcon={false}>Imported 12 rows.</Alert>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('announces a warning politely, like a success', () => {
    render(<Alert tone="warning">Changing the role signs them out.</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Changing the role signs them out.');
  });

  it('offers no dismiss button unless the caller can handle it', () => {
    // A banner the caller cannot clear must not pretend to be dismissible — hiding it would
    // leave the state that produced it still true, with nothing on screen explaining why.
    render(<Alert>Saved.</Alert>);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('dismisses when asked', async () => {
    const onDismiss = vi.fn();
    render(<Alert onDismiss={onDismiss}>Saved.</Alert>);

    await userEvent.click(screen.getByRole('button', { name: /dismiss message/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('takes a custom name for the dismiss button', async () => {
    const onDismiss = vi.fn();
    render(
      <Alert tone="danger" onDismiss={onDismiss} dismissLabel="Hide this error">
        Nope
      </Alert>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hide this error' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
