import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { PermissionAction } from '@oses/types';

import { PERMISSIONS_KEY } from '../../shared/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../principal';
import { PermissionResolver } from '../services/permission-resolver';

/**
 * Enforces `@RequirePermissions(...)`. Resolves the caller's granted actions from their
 * roleId and allows the request only if every required action is present. Runs after
 * JwtAuthGuard (which populates `request.user`).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionAction[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (!(await this.resolver.hasAll(user.roleId, required))) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}
