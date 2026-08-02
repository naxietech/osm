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
