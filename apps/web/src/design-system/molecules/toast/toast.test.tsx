import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './toast';

/** A bare consumer: one button per tone, so a test raises exactly what it means to. */
function Raiser(): React.ReactElement {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Saved.')}>raise success</button>
      <button onClick={() => toast.error('That did not work.')}>raise error</button>
      <button onClick={() => toast.warning('Careful.')}>raise warning</button>
    </div>
  );
}

/**
 * `fireEvent`, not `userEvent`. This component *is* a timer, so the tests own a fake clock — and
 * `userEvent.setup()` schedules its own delays on that same clock, which deadlocks: it waits for
 * time the test has not advanced yet, and the test waits for the click to resolve.
 */
function renderWithProvider(): void {
  render(
    <ToastProvider>
      <Raiser />
    </ToastProvider>,
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ToastProvider', () => {
  it('shows the message it was given', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('raise success'));

    expect(screen.getByText('Saved.')).toBeInTheDocument();
  });

  it('withdraws itself after ten seconds, and not a moment before', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('raise success'));
    expect(screen.getByText('Saved.')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(9_999));
    expect(screen.getByText('Saved.')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('can be dismissed early', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('raise success'));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('stacks several at once and expires each on its own clock', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('raise success'));
    act(() => void vi.advanceTimersByTime(6_000));
    fireEvent.click(screen.getByText('raise error'));

    expect(screen.getByText('Saved.')).toBeInTheDocument();
    expect(screen.getByText('That did not work.')).toBeInTheDocument();

    // The first one's ten seconds are up; the second still has six to go.
    act(() => void vi.advanceTimersByTime(4_000));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
    expect(screen.getByText('That did not work.')).toBeInTheDocument();
  });

  /**
   * An error interrupts; a confirmation does not. `alert` is announced immediately, `status`
   * waits for a pause — getting this backwards either talks over the user or buries a failure.
   */
  it('announces a failure assertively and a confirmation politely', () => {
    renderWithProvider();

    fireEvent.click(screen.getByText('raise error'));
    expect(screen.getByRole('alert')).toHaveTextContent('That did not work.');

    fireEvent.click(screen.getByText('raise success'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  });

  it('refuses to be used without a provider, rather than silently doing nothing', () => {
    // A confirmation that never appears is the failure this whole component exists to prevent,
    // so it must be loud at the point of the mistake.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Raiser />)).toThrow(/useToast must be used inside/);
    quiet.mockRestore();
  });
});
