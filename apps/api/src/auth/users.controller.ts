import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { SafeUser } from '@oses/types';

import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  type CreateUserDto,
  CreateUserSchema,
  type ResetPasswordDto,
  ResetPasswordSchema,
  type UpdateStatusDto,
  UpdateStatusSchema,
} from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import type { AuthPrincipal } from './principal';
import { UsersService } from './services';

/**
 * Admin user provisioning. Every route requires authentication (JwtAuthGuard) plus the
 * `users.manage` grant (PermissionsGuard) — which, per the seed, only Super Admin holds.
 */
@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Create a user with a role + temporary password' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 403, description: 'Missing users.manage grant' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  create(
    @CurrentUser() actor: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
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
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.users.resetPassword(id, dto, actor.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Activate or suspend a user account' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  setStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateStatusSchema)) dto: UpdateStatusDto,
  ): Promise<{ message: string }> {
    return this.users.setStatus(id, dto, actor.sub);
  }
}
