import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { PaginatedUsers, SafeUser } from '@oses/types';

import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { ZodValidationPipe, uuidParam } from '../shared/pipes';
import {
  type CreateUserRequestDto,
  CreateUserSchema,
  type ListUsersQuery,
  ListUsersSchema,
  type ResetPasswordDto,
  ResetPasswordSchema,
  type UpdateStatusDto,
  UpdateStatusSchema,
  type UpdateUserDto,
  UpdateUserSchema,
} from './dto';
import { ActiveUserGuard } from './guards/active-user.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { USER_STATUSES } from './ports';
import type { AuthPrincipal } from './principal';
import { UsersService } from './services';

/**
 * Admin user provisioning. Every route requires authentication (JwtAuthGuard) plus the
 * `users.manage` grant (PermissionsGuard) — which, per the seed, only Super Admin holds.
 */
@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, ActiveUserGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary: 'List users (paginated, newest first)',
    description:
      'All filters combine with AND, and `total` is narrowed by the same set as the page, so ' +
      '"showing 10 of 3" cannot happen. Soft-deleted users never appear.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'q', required: false, description: 'Search email or name (case-insensitive)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: USER_STATUSES,
    description: 'Exact account status',
  })
  @ApiQuery({ name: 'roleId', required: false, description: 'Exact role id (uuid)' })
  @ApiResponse({ status: 200, description: '{ items: SafeUser[], total }' })
  @ApiResponse({ status: 403, description: 'Missing users.manage grant' })
  list(
    @Query(new ZodValidationPipe(ListUsersSchema)) query: ListUsersQuery,
  ): Promise<PaginatedUsers> {
    return this.users.listUsers(query);
  }

  @Post()
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Create a user with a role + temporary password' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Unknown role, or role/institute mismatch' })
  @ApiResponse({ status: 403, description: 'Missing users.manage grant' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  create(
    @CurrentUser() actor: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserRequestDto,
  ): Promise<SafeUser> {
    return this.users.createUser(dto, actor.sub);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Set a new temporary password for a user (admin reset)' })
  @ApiResponse({ status: 200, description: 'Reset' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resetPassword(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', uuidParam('User')) id: string,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.users.resetPassword(id, dto, actor.sub);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary: "Edit a user's email, name, role or institute",
    description:
      'Every field is optional; omitting one leaves it alone. Changing the role revokes the ' +
      "user's sessions, because the access token carries the role and would otherwise keep the " +
      'old permissions alive until it expired. Moving an account onto the Institute role requires ' +
      'an instituteId; moving it off any other role clears the one it had. Password and status ' +
      'have their own endpoints.',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({
    status: 400,
    description: 'Unknown role, own role, last Super Admin, or role/institute mismatch',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ): Promise<SafeUser> {
    return this.users.updateUser(id, dto, actor.sub);
  }

  @Delete(':id')
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary: 'Delete a user (soft)',
    description:
      'The row is retained so the audit trail and every created_by reference stay intact. The ' +
      'account disappears from listings, cannot sign in, and its sessions are revoked at once.',
  })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Own account, or the last active Super Admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.users.deleteUser(id, actor.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('users.manage')
  @ApiOperation({
    summary: 'Activate or deactivate a user account',
    description:
      "status is 'active' or 'deactivate'. Deactivating revokes the user's sessions at once; " +
      'reactivating also clears any login lockout. Reversible — unlike DELETE, the account stays ' +
      'visible in listings throughout.',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Own account, or the last active Super Admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  setStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', uuidParam('User')) id: string,
    @Body(new ZodValidationPipe(UpdateStatusSchema)) dto: UpdateStatusDto,
  ): Promise<{ message: string }> {
    return this.users.setStatus(id, dto, actor.sub);
  }
}
