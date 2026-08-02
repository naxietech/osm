import { SESSION_HINT_COOKIE } from '@oses/types';

/**
 * Has anyone signed in on this browser?
 *
 * Reads the one cookie the API leaves readable (see `SESSION_HINT_COOKIE`). It is a hint and
 * nothing more: it holds no secret, it can be stale, and a user can delete it by hand. Being
 * wrong costs a wasted `/auth/me` or a login form shown to someone who could have been sent
 * straight through — never access granted or denied.
 *
 * Its whole job is letting the login page skip the session check for visitors who have plainly
 * never signed in here, which is most of them.
 */
export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((entry) => entry.trim().startsWith(`${SESSION_HINT_COOKIE}=`));
}

/**
 * Forget the marker, because we have just learned there is no session behind it.
 *
 * The API clears it on sign-out, but that is only the tidy path. A session that simply expires,
 * a sign-out request that never reached the server, an account suspended while a tab sat open —
 * all leave the marker behind with nothing behind it. Left alone it never expires on its own
 * (its max-age is the refresh window, renewed on every login), so every later visit to `/login`
 * pays the `/auth/me` 401 *and* the renewal attempt the client fires behind it: two wasted round
 * trips, forever, which is precisely the cost the marker exists to avoid.
 *
 * Deleting a cookie means re-setting it expired with the same scope. We do not know which scope
 * the API used — `COOKIE_DOMAIN` may have scoped it to a parent domain — and a host-only delete
 * leaves a parent-domain cookie untouched, so try the host and then each parent in turn. The
 * browser ignores the ones that don't apply (and refuses public suffixes outright), so the extra
 * attempts are harmless. On `localhost` there are no parents and the first line does it.
 */
export function clearSessionHint(): void {
  if (typeof document === 'undefined') return;
  const expired = `${SESSION_HINT_COOKIE}=; Max-Age=0; path=/`;
  document.cookie = expired;

  const labels = window.location.hostname.split('.');
  for (let i = 0; i < labels.length - 1; i += 1) {
    document.cookie = `${expired}; domain=${labels.slice(i).join('.')}`;
  }
}
