import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { UserRepository } from '../ports';
import { ActiveUserGuard } from './active-user.guard';

function ctxFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('ActiveUserGuard', () => {
  let users: { findById: jest.Mock };
  let guard: ActiveUserGuard;

  beforeEach(() => {
    users = { findById: jest.fn() };
    guard = new ActiveUserGuard(users as unknown as UserRepository);
  });

  it('allows an active user whose token still matches their role', async () => {
    users.findById.mockResolvedValue({ id: 'u1', status: 'active', roleId: 'role-a' });
    await expect(guard.canActivate(ctxFor({ sub: 'u1', roleId: 'role-a' }))).resolves.toBe(true);
    expect(users.findById).toHaveBeenCalledWith('u1');
  });

  it('rejects a deactivated user even with a valid token (#2)', async () => {
    users.findById.mockResolvedValue({ id: 'u1', status: 'deactivate', roleId: 'role-a' });
    await expect(guard.canActivate(ctxFor({ sub: 'u1', roleId: 'role-a' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token whose role no longer matches the account', async () => {
    // The demotion window: PermissionsGuard reads roleId off the token, so without this the
    // holder keeps the permissions they were stripped of until the token expires (~15 min).
    // Revoking sessions cannot help — it stops the next token, not the one already issued.
    users.findById.mockResolvedValue({ id: 'u1', status: 'active', roleId: 'role-checker' });
    await expect(
      guard.canActivate(ctxFor({ sub: 'u1', roleId: 'role-super-admin' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the user no longer exists', async () => {
    users.findById.mockResolvedValue(null);
    await expect(guard.canActivate(ctxFor({ sub: 'u1' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when unauthenticated (no principal on the request)', async () => {
    await expect(guard.canActivate(ctxFor(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.findById).not.toHaveBeenCalled();
  });
});
