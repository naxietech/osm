import { useQuery } from '@tanstack/react-query';

import type { Role } from '@oses/types';

import { rolesService } from '@/services/roles.service';

import { useAuth } from './use-auth';

export const ROLES_KEY = ['roles'] as const;

/**
 * The role catalogue from `GET /roles`.
 *
 * Roles are seeded by the server and have no write endpoints, so the list cannot change
 * while the app is open — hence `staleTime: Infinity`. Four screens need it (the roles
 * list and detail, and both users screens); sharing one hook keeps them on one fetch and
 * one caching policy rather than four copies that can drift.
 *
 * Requires the `users.manage` grant, so a caller without it gets a 403. Every screen using
 * this is already Super-Admin-gated.
 *
 * `enabled` is not optional here. Signing out drops every cached query, and removing a query
 * that a mounted screen is still watching makes it ask again — with the session that was just
 * cancelled. That 401 then sends the client off to renew a session the user deliberately
 * ended, and the failure lands in the audit log looking like a rejected token. Gating on the
 * session means the query goes quiet the moment the user is signed out.
 */
export function useRoles(): {
  roles: Role[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();

  const query = useQuery({
    queryKey: ROLES_KEY,
    queryFn: () => rolesService.listRoles(),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  return {
    roles: query.data ?? [],
    // A disabled query does not report as loading, so fold in whether we even know who the
    // user is yet — otherwise "no roles fetched" reads as "there are no roles".
    isLoading: sessionLoading || query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
