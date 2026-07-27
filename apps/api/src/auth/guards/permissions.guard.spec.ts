import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import type { PermissionResolver } from '../services/permission-resolver';
import { PermissionsGuard } from './permissions.guard';

function ctxFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let resolver: { hasAll: jest.Mock };
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    resolver = { hasAll: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      resolver as unknown as PermissionResolver,
    );
  });

  it('allows when the route requires no permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(ctxFor({ roleId: 'role_checker' }))).resolves.toBe(true);
  });

  it('allows when the role grants all required actions', async () => {
    reflector.getAllAndOverride.mockReturnValue(['marking.mark']);
    resolver.hasAll.mockResolvedValue(true);
    await expect(guard.canActivate(ctxFor({ roleId: 'role_checker' }))).resolves.toBe(true);
    expect(resolver.hasAll).toHaveBeenCalledWith('role_checker', ['marking.mark']);
  });

  it('denies (403) when a required action is not granted', async () => {
    reflector.getAllAndOverride.mockReturnValue(['students.viewPII']);
    resolver.hasAll.mockResolvedValue(false);
    await expect(guard.canActivate(ctxFor({ roleId: 'role_checker' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies (403) when unauthenticated', async () => {
    reflector.getAllAndOverride.mockReturnValue(['marking.mark']);
    await expect(guard.canActivate(ctxFor(undefined))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
