import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { PermissionAction } from '@oses/types';

import { PERMISSIONS_KEY } from '../../shared/decorators/require-permissions.decorator';
import {
  TARGET_INSTITUTE_KEY,
  type TargetInstitutePath,
} from '../../shared/decorators/target-institute.decorator';
import type { AuthPrincipal } from '../principal';
import { PermissionResolver } from '../services/permission-resolver';

interface GuardRequest {
  user?: AuthPrincipal;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

/**
 * Enforces `@RequirePermissions(...)`. Resolves the caller's granted actions from their
 * roleId and allows the request only if every required action is present. Runs after
 * JwtAuthGuard (which populates `request.user`).
 *
 * Additionally enforces `own-institute` scope centrally: when a route declares
 * `@TargetInstitute(...)` and the caller holds a required action at `own-institute` scope,
 * the request is rejected unless the target institute matches the caller's own institute.
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

    const request = context.switchToHttp().getRequest<GuardRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (!(await this.resolver.hasAll(user.roleId, required))) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }

    await this.enforceOwnInstituteScope(context, request, user, required);
    return true;
  }

  /**
   * If the route declares where the target institute lives and the caller holds any required
   * action at `own-institute` scope, the target must equal the caller's institute (fail-closed:
   * a missing target is also rejected).
   */
  private async enforceOwnInstituteScope(
    context: ExecutionContext,
    request: GuardRequest,
    user: AuthPrincipal,
    required: PermissionAction[],
  ): Promise<void> {
    const targetPath = this.reflector.getAllAndOverride<TargetInstitutePath>(TARGET_INSTITUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!targetPath) return;

    const scopes = await Promise.all(required.map((a) => this.resolver.scopeFor(user.roleId, a)));
    if (!scopes.includes('own-institute')) return;

    // Fail-closed: an own-institute caller must be bound to an institute AND the target must
    // match it (a missing/undefined target is rejected, not waved through).
    if (!user.instituteId || readRequestPath(request, targetPath) !== user.instituteId) {
      throw new ForbiddenException('Cross-institute access is not allowed');
    }
  }
}

function readRequestPath(request: GuardRequest, path: TargetInstitutePath): string | undefined {
  const dot = path.indexOf('.');
  const source = path.slice(0, dot) as 'params' | 'query' | 'body';
  const key = path.slice(dot + 1);
  const value = request[source]?.[key];
  return typeof value === 'string' ? value : undefined;
}
