import type { JwtPayload } from '@oses/types';

/**
 * The authenticated caller attached to `request.user` after JwtAuthGuard. A superset of
 * @oses/types `JwtPayload` that carries the authoritative data-driven role (`roleId`);
 * authorization keys off `roleId` + grants, not the legacy `role` enum.
 */
export interface AuthPrincipal extends JwtPayload {
  roleId: string;
}
