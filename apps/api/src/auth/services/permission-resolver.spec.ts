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
        { action: 'students.manage', scope: 'own-institute' },
      ]),
    };
    resolver = new PermissionResolver(repo as unknown as GrantsRepository);
  });

  it('returns the grants for a role', async () => {
    expect(await resolver.grantsFor('role_checker')).toHaveLength(3);
  });

  it('scopeFor returns the scope of a granted action, or undefined if ungranted', async () => {
    await expect(resolver.scopeFor('role_institute', 'students.manage')).resolves.toBe(
      'own-institute',
    );
    await expect(resolver.scopeFor('role_institute', 'dashboard.view')).resolves.toBe('all');
    await expect(resolver.scopeFor('role_institute', 'clients.manage')).resolves.toBeUndefined();
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
