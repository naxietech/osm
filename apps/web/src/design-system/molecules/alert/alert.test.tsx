import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  describe('dismissing', () => {
    it('has no close button unless a handler is given', () => {
      render(<Alert>Saved.</Alert>);
      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    });

    it('closes on click when a handler is given', async () => {
      const onDismiss = vi.fn();
      render(<Alert onDismiss={onDismiss}>Saved.</Alert>);

      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('offers the close button on a danger alert too', () => {
      render(
        <Alert tone="danger" onDismiss={vi.fn()}>
          Nope.
        </Alert>,
      );
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });
  });

  describe('auto-dismiss', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('closes a success on its own after the delay', () => {
      vi.useFakeTimers();
      const onDismiss = vi.fn();
      render(
        <Alert onDismiss={onDismiss} autoDismissMs={5000}>
          Saved.
        </Alert>,
      );

      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('never auto-closes a failure, even when asked to', () => {
      // An error is often the only explanation a user has for why something did not work.
      // The guard lives here so one forgetful call site cannot drop it.
      vi.useFakeTimers();
      const onDismiss = vi.fn();
      render(
        <Alert tone="danger" onDismiss={onDismiss} autoDismissMs={5000}>
          That code is taken.
        </Alert>,
      );

      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('is not restarted by unrelated re-renders', () => {
      // Callers pass an inline arrow, which is a new function every render. If the countdown
      // depended on it, anything re-rendering the page — typing in a search box — would reset
      // the timer and the banner would never go away.
      vi.useFakeTimers();
      const onDismiss = vi.fn();
      const { rerender } = render(
        <Alert
          onDismiss={() => {
            onDismiss();
          }}
          autoDismissMs={5000}
        >
          Saved.
        </Alert>,
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      // A fresh handler identity, as a parent re-render would produce.
      rerender(
        <Alert
          onDismiss={() => {
            onDismiss();
          }}
          autoDismissMs={5000}
        >
          Saved.
        </Alert>,
      );
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not leave a timer running after unmount', () => {
      vi.useFakeTimers();
      const onDismiss = vi.fn();
      const { unmount } = render(
        <Alert onDismiss={onDismiss} autoDismissMs={5000}>
          Saved.
        </Alert>,
      );

      unmount();
      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});
