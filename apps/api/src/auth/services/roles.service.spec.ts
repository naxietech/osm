import type { RoleRepository } from '../ports';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  it('maps role records to the @oses/types Role shape (ISO createdAt, undefined instituteId)', async () => {
    const repo = {
      listWithGrants: jest.fn().mockResolvedValue([
        {
          id: 'role_checker',
          name: 'Evaluator',
          isSystem: true,
          instituteId: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          grants: [{ action: 'marking.mark', scope: 'all' }],
        },
      ]),
    };
    const service = new RolesService(repo as unknown as RoleRepository);

    const roles = await service.listRoles();
    expect(roles).toHaveLength(1);
    const [role] = roles;
    expect(role?.id).toBe('role_checker');
    expect(role?.instituteId).toBeUndefined();
    expect(role?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(role?.grants[0]?.action).toBe('marking.mark');
  });
});
