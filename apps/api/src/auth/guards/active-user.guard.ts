import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { USER_REPOSITORY, type UserRepository } from '../ports';
import type { AuthPrincipal } from '../principal';

/**
 * Re-checks the caller's LIVE account against the database (Option C for the
 * deactivate/reset/demote propagation gap): a stateless access token is trusted for its full
 * ~15-min life, so on high-value routes we look the user up and reject anyone whose account has
 * moved on since the token was minted. Costs one indexed lookup — applied only to the
 * user-management controllers, keeping ordinary read routes stateless. Runs after JwtAuthGuard
 * (which populates `request.user`).
 *
 * Two things are compared, and both matter:
 *
 * - **status** — a deactivated or deleted account must stop acting at once.
 * - **roleId** — the token carries the role, and `PermissionsGuard` reads it from there. Without
 *   this comparison a demoted user keeps the permissions printed on their old token until it
 *   expires: revoking their sessions only stops them getting a *new* token, it cannot un-issue
 *   the one already in their browser. Measured: a Super Admin demoted to Evaluator could still
 *   call `GET /users` immediately afterwards. The lookup is already paid for by the status
 *   check, so closing this costs nothing.
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const principal = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user;
    if (!principal) throw new UnauthorizedException('Not authenticated');

    const user = await this.users.findById(principal.sub);
    if (!user || user.status !== 'active' || user.roleId !== principal.roleId) {
      throw new UnauthorizedException('Session no longer valid');
    }
    return true;
  }
}
