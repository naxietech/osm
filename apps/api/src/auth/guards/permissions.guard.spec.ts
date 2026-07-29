import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../../shared/decorators/require-permissions.decorator';
import { TARGET_INSTITUTE_KEY } from '../../shared/decorators/target-institute.decorator';
import type { PermissionResolver } from '../services/permission-resolver';
import { PermissionsGuard } from './permissions.guard';

function ctxFor(user: unknown, extras: Record<string, unknown> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, ...extras }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let resolver: { hasAll: jest.Mock; scopeFor: jest.Mock };
  let guard: PermissionsGuard;

  // Route metadata: required actions + optional @TargetInstitute path.
  function meta(required: unknown, targetPath?: unknown): void {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PERMISSIONS_KEY ? required : key === TARGET_INSTITUTE_KEY ? targetPath : undefined,
    );
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    resolver = { hasAll: jest.fn().mockResolvedValue(true), scopeFor: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      resolver as unknown as PermissionResolver,
    );
  });

  it('allows when the route requires no permissions', async () => {
    meta(undefined);
    await expect(guard.canActivate(ctxFor({ roleId: 'role_checker' }))).resolves.toBe(true);
  });

  it('allows when the role grants all required actions', async () => {
    meta(['marking.mark']);
    await expect(guard.canActivate(ctxFor({ roleId: 'role_checker' }))).resolves.toBe(true);
    expect(resolver.hasAll).toHaveBeenCalledWith('role_checker', ['marking.mark']);
  });

  it('denies (403) when a required action is not granted', async () => {
    meta(['students.viewPII']);
    resolver.hasAll.mockResolvedValue(false);
    await expect(guard.canActivate(ctxFor({ roleId: 'role_checker' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies (403) when unauthenticated', async () => {
    meta(['marking.mark']);
    await expect(guard.canActivate(ctxFor(undefined))).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('own-institute scope enforcement (#10)', () => {
    const institute = { roleId: 'role_institute', instituteId: 'inst-A' };

    it('allows an institute caller acting within their own institute', async () => {
      meta(['students.manage'], 'params.instituteId');
      resolver.scopeFor.mockResolvedValue('own-institute');
      const ctx = ctxFor(institute, { params: { instituteId: 'inst-A' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('denies an institute caller acting on another institute (403)', async () => {
      meta(['students.manage'], 'params.instituteId');
      resolver.scopeFor.mockResolvedValue('own-institute');
      const ctx = ctxFor(institute, { params: { instituteId: 'inst-B' } });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies when the target institute is missing (fail-closed)', async () => {
      meta(['students.manage'], 'params.instituteId');
      resolver.scopeFor.mockResolvedValue('own-institute');
      const ctx = ctxFor(institute, { params: {} });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does NOT restrict a global (scope=all) caller', async () => {
      meta(['students.manage'], 'params.instituteId');
      resolver.scopeFor.mockResolvedValue('all');
      const ctx = ctxFor({ roleId: 'role_admin' }, { params: { instituteId: 'inst-B' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('skips scope enforcement when the route declares no target institute', async () => {
      meta(['students.manage'], undefined);
      const ctx = ctxFor(institute, { params: { instituteId: 'inst-B' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(resolver.scopeFor).not.toHaveBeenCalled();
    });
  });
});
