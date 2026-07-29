import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { Role } from '@oses/types';

import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { ActiveUserGuard } from './guards/active-user.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesService } from './services';

/**
 * Read-only role catalogue — used to populate the role picker on the user-create screen,
 * so it's gated by the same `users.manage` grant (Super Admin) as user provisioning.
 */
@ApiTags('roles')
@ApiCookieAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, ActiveUserGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'List the roles and their permission grants' })
  @ApiResponse({ status: 200, description: 'Role[]' })
  @ApiResponse({ status: 403, description: 'Missing users.manage grant' })
  list(): Promise<Role[]> {
    return this.roles.listRoles();
  }
}
