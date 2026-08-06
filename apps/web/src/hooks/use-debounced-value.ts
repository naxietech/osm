import { useEffect, useState } from 'react';

/** How long a search box waits after the last keystroke before the value counts as settled. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The value, but only after it has stopped changing for `delay` ms.
 *
 * Typing into a search box should not fire a request per keystroke — "khan" would send four,
 * three of which are already stale by the time they land, and whose responses can arrive out
 * of order and paint the wrong results. Debouncing collapses a burst of keystrokes into the
 * one query the user actually meant.
 *
 * The input stays instant: the caller keeps rendering the raw value, and only the *derived*
 * value returned here lags, so the field never feels sticky.
 */
export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    // Every new keystroke cancels the pending one, so only the last of a burst survives.
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
