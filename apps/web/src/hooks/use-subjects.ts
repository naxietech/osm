import { useQuery } from '@tanstack/react-query';

import type { Subject } from '@oses/types';

import { subjectsService } from '@/services/subjects.service';

import { useAuth } from './use-auth';

export const SUBJECTS_KEY = ['subjects'] as const;

/**
 * The subject catalogue from `GET /subjects`, deactivated rows included.
 *
 * One hook so every screen that needs subjects shares a single fetch and a single caching
 * policy, rather than several copies that can drift. Mutations invalidate `SUBJECTS_KEY`, so
 * exporting the key matters — an invalidation that misses it leaves a new subject invisible
 * until the cache expires.
 *
 * Requires the `subjects.manage` grant, so a caller without it gets a 403. The management
 * screen is already Super-Admin-gated.
 *
 * `enabled` is not optional here, for the same reason as `use-roles`: signing out drops every
 * cached query, and a dropped query that a mounted screen is still watching asks again — with
 * the session that was just cancelled. That 401 sends the client off to renew a session the
 * user deliberately ended, and the failure lands in the audit log looking like a rejected
 * token. Gating on the session keeps the query quiet once the user is signed out.
 */
export function useSubjects(): {
  subjects: Subject[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();

  const query = useQuery({
    queryKey: SUBJECTS_KEY,
    queryFn: () => subjectsService.listSubjects(),
    enabled: isAuthenticated,
  });

  return {
    subjects: query.data ?? [],
    // A disabled query does not report as loading, so fold in whether we even know who the
    // user is yet — otherwise "no subjects fetched" reads as "there are no subjects".
    isLoading: sessionLoading || query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
