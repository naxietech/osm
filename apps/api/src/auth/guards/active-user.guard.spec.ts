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

  it('allows an active user', async () => {
    users.findById.mockResolvedValue({ id: 'u1', status: 'active' });
    await expect(guard.canActivate(ctxFor({ sub: 'u1' }))).resolves.toBe(true);
    expect(users.findById).toHaveBeenCalledWith('u1');
  });

  it('rejects a suspended user even with a valid token (#2)', async () => {
    users.findById.mockResolvedValue({ id: 'u1', status: 'suspended' });
    await expect(guard.canActivate(ctxFor({ sub: 'u1' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
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
