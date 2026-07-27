import type { GrantsRepository } from '../ports';
import { PermissionResolver } from './permission-resolver';

describe('PermissionResolver', () => {
  let repo: { listByRoleId: jest.Mock };
  let resolver: PermissionResolver;

  beforeEach(() => {
    repo = {
      listByRoleId: jest.fn().mockResolvedValue([
        { action: 'marking.mark', scope: 'all' },
        { action: 'dashboard.view', scope: 'all' },
      ]),
    };
    resolver = new PermissionResolver(repo as unknown as GrantsRepository);
  });

  it('returns the grants for a role', async () => {
    expect(await resolver.grantsFor('role_checker')).toHaveLength(2);
  });

  it('caches — the repository is hit only once across calls', async () => {
    await resolver.grantsFor('role_checker');
    await resolver.grantsFor('role_checker');
    expect(repo.listByRoleId).toHaveBeenCalledTimes(1);
  });

  it('hasAll is true only when every action is granted', async () => {
    await expect(resolver.hasAll('role_checker', ['marking.mark'])).resolves.toBe(true);
    await expect(resolver.hasAll('role_checker', ['students.viewPII'])).resolves.toBe(false);
    await expect(
      resolver.hasAll('role_checker', ['marking.mark', 'students.viewPII']),
    ).resolves.toBe(false);
  });

  it('clear() drops the cache', async () => {
    await resolver.grantsFor('role_checker');
    resolver.clear();
    await resolver.grantsFor('role_checker');
    expect(repo.listByRoleId).toHaveBeenCalledTimes(2);
  });
});
