import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './use-debounced-value';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  it('returns the first value straight away', () => {
    const { result } = renderHook(() => useDebouncedValue('khan', 300));
    expect(result.current).toBe('khan');
  });

  it('holds the new value back until the delay has passed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'k' },
    });

    rerender({ value: 'kh' });
    expect(result.current).toBe('k');

    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe('kh');
  });

  it('collapses a burst of keystrokes into the last one', () => {
    // The point of the hook: "khan" typed quickly is one query, not four, and the three
    // stale ones can never come back out of order and repaint the wrong results.
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '' },
    });

    for (const value of ['k', 'kh', 'kha', 'khan']) {
      rerender({ value });
      act(() => void vi.advanceTimersByTime(100));
    }

    expect(result.current).toBe('');

    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe('khan');
  });
});
