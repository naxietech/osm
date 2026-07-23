import { type Checker } from '@oses/types';

import { findCheckerByUserId } from '@/services/checker.service';

import { useAuth } from './use-auth';

/**
 * The checker record behind the signed-in user, or undefined if they are not one.
 *
 * Approving a registration is what mints the Evaluator login and stores its `userId`, so
 * this is the only supported way for a checker's own screens to learn whose workload to
 * load. Every evaluator page derives its scope from here rather than from the URL, so a
 * checker cannot widen it by editing the address bar.
 */
export function useCurrentChecker(): Checker | undefined {
  const { user } = useAuth();
  return user ? findCheckerByUserId(user.id) : undefined;
}
