import { useQuery } from '@tanstack/react-query';

import type { Role } from '@oses/types';

import { rolesService } from '@/services/roles.service';

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
 */
export function useRoles(): {
  roles: Role[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const query = useQuery({
    queryKey: ROLES_KEY,
    queryFn: () => rolesService.listRoles(),
    staleTime: Infinity,
  });

  return {
    roles: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
