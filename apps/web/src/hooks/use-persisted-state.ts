import { useCallback, useEffect, useState } from 'react';

/**
 * State that survives a page refresh, kept in the browser rather than on the server.
 *
 * Built for the public institute-registration form, which is long enough that losing it to an
 * accidental refresh is the single worst thing that can happen to an applicant. The alternative
 * — saving drafts server-side and handing back a resume link — needs a table, an expiry policy
 * and a token that is itself a small credential, all to solve a problem the browser already
 * solves for free.
 *
 * `sessionStorage`, not `localStorage`: the form holds a password the applicant just chose, and
 * that should not outlive the tab. It also means a shared machine does not offer the next person
 * a half-filled application.
 *
 * Storage can throw — Safari's private mode, a full quota, a hardened browser. Every access is
 * guarded, and a failure degrades to ordinary in-memory state rather than breaking the form.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((previous: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => readStored(key) ?? initial);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Nothing to do and nothing worth telling the user: their work is still on screen, it just
      // will not survive a refresh. Failing loudly here would be worse than the problem.
    }
  }, [key, value]);

  const clear = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Same reasoning as above.
    }
  }, [key]);

  return [value, setValue, clear];
}

/**
 * Returns the stored value, or null when there is nothing usable.
 *
 * Anything stored under an older version of the form is unparseable or the wrong shape, and a
 * malformed value would crash the form on load — the one moment the applicant has no way to
 * recover. Treating it as absent is the safe read.
 */
function readStored<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}
