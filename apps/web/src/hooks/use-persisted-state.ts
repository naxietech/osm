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
 * `sessionStorage`, not `localStorage`: a half-filled application should not outlive the tab, and
 * a shared machine must not offer it to the next person. The registration form's two password
 * fields are excluded from what it stores at all — see `InstituteRegistrationDraft`, which omits
 * them from the type so a caller cannot persist them by accident.
 *
 * Storage can throw — Safari's private mode, a full quota, a hardened browser. Every access is
 * guarded, and a failure degrades to ordinary in-memory state rather than breaking the form.
 * Degrading quietly for the *applicant* is right; degrading quietly for whoever has to explain
 * why a draft vanished is not, so each failure is traced to the console with the key that failed.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((previous: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => readStored(key) ?? initial);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Nothing to do and nothing worth telling the user: their work is still on screen, it just
      // will not survive a refresh. Failing loudly here would be worse than the problem — but it
      // is the one trace of "my form emptied itself" anyone will ever get, so it is not silent.
      console.error(`usePersistedState: could not save "${key}" to sessionStorage.`, err);
    }
  }, [key, value]);

  const clear = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key);
    } catch (err) {
      // Same reasoning as above. A failure here leaves a stale draft behind, which a later visit
      // would silently reopen — worth knowing about even though nothing can be done in the moment.
      console.error(`usePersistedState: could not clear "${key}" from sessionStorage.`, err);
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
 *
 * This is the catch most worth tracing. A key that is bumped but not cleaned up, or a shape that
 * changed without its version, shows up here as every applicant quietly starting from an empty
 * form — indistinguishable from the feature simply not working.
 */
function readStored<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object') return parsed as T;
    console.error(
      `usePersistedState: stored value for "${key}" is not an object — ignoring it and starting fresh.`,
    );
    return null;
  } catch (err) {
    console.error(`usePersistedState: could not read "${key}" from sessionStorage.`, err);
    return null;
  }
}
