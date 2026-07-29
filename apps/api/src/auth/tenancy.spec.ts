import { ForbiddenException } from '@nestjs/common';

import type { AuthPrincipal } from './principal';
import { assertOwnInstitute } from './tenancy';

const globalCaller = { roleId: 'role_admin' } as AuthPrincipal;
const instituteCaller = { roleId: 'role_institute', instituteId: 'inst-A' } as AuthPrincipal;

describe('assertOwnInstitute', () => {
  it('lets a global caller (no institute binding) touch any record', () => {
    expect(() => assertOwnInstitute(globalCaller, 'inst-Z')).not.toThrow();
    expect(() => assertOwnInstitute(globalCaller, null)).not.toThrow();
  });

  it('lets an institute caller touch their own institute', () => {
    expect(() => assertOwnInstitute(instituteCaller, 'inst-A')).not.toThrow();
  });

  it('blocks an institute caller from another institute (or an unowned record)', () => {
    expect(() => assertOwnInstitute(instituteCaller, 'inst-B')).toThrow(ForbiddenException);
    expect(() => assertOwnInstitute(instituteCaller, null)).toThrow(ForbiddenException);
  });
});
