import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';

function ctxFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows when the route restricts no roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctxFor({ roleId: 'role_admin' }))).toBe(true);
  });

  it('allows when the roleId is permitted', () => {
    reflector.getAllAndOverride.mockReturnValue(['role_super_admin']);
    expect(guard.canActivate(ctxFor({ roleId: 'role_super_admin' }))).toBe(true);
  });

  it('denies a different roleId — Super Admin ≠ Admin', () => {
    reflector.getAllAndOverride.mockReturnValue(['role_super_admin']);
    expect(() => guard.canActivate(ctxFor({ roleId: 'role_admin' }))).toThrow(ForbiddenException);
  });

  it('denies when unauthenticated', () => {
    reflector.getAllAndOverride.mockReturnValue(['role_super_admin']);
    expect(() => guard.canActivate(ctxFor(undefined))).toThrow(ForbiddenException);
  });
});
