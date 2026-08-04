import { useQuery } from '@tanstack/react-query';

import type { AcademicClass } from '@oses/types';

import { classesService } from '@/services/classes.service';

import { useAuth } from './use-auth';

export const CLASSES_KEY = ['classes'] as const;

/**
 * The class list from `GET /classes`, each class carrying its full group tree.
 *
 * One query and one caching policy for every screen that needs classes — the management
 * screen today, and the student and exam forms once they migrate off the mock. Sharing the
 * hook keeps them on one fetch rather than several that can drift.
 *
 * No `staleTime` override: classes change rarely but they *do* change from inside the app, so
 * they take the client default (30s) rather than the `Infinity` roles get. Mutations invalidate
 * {@link CLASSES_KEY} explicitly, so a save is visible immediately either way.
 *
 * `enabled` is not optional here. Signing out drops every cached query, and removing a query a
 * mounted screen is still watching makes it ask again — with the session that was just
 * cancelled. That 401 sends the client off to renew a session the user deliberately ended, and
 * the failure lands in the audit log looking like a rejected token.
 */
export function useClasses(): {
  classes: AcademicClass[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();

  const query = useQuery({
    queryKey: CLASSES_KEY,
    queryFn: () => classesService.listClasses(),
    enabled: isAuthenticated,
  });

  return {
    classes: query.data ?? [],
    // A disabled query does not report as loading, so fold in whether we even know who the
    // user is yet — otherwise "no classes fetched" reads as "there are no classes".
    isLoading: sessionLoading || query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
