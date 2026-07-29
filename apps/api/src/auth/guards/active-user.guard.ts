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
 * Re-checks the caller's LIVE account status against the database (Option C for the
 * suspend/reset propagation gap): a stateless access token is trusted for its full ~15-min
 * life, so on high-value routes we look the user up and reject a suspended or removed account
 * before it can act. Costs one indexed lookup — applied only to the user-management
 * controllers, keeping ordinary read routes stateless. Runs after JwtAuthGuard (which
 * populates `request.user`).
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const principal = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user;
    if (!principal) throw new UnauthorizedException('Not authenticated');

    const user = await this.users.findById(principal.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Session no longer valid');
    }
    return true;
  }
}
