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
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ActiveUserGuard } from '../../auth/guards/active-user.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { AuthPrincipal } from '../../auth/principal';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { AdminInstituteCategory } from './category-mapper';
import {
  type CreateInstituteCategoryRequestDto,
  CreateInstituteCategorySchema,
  type UpdateCategoryStatusDto,
  UpdateCategoryStatusSchema,
  type UpdateInstituteCategoryRequestDto,
  UpdateInstituteCategorySchema,
} from './dto';
import { InstituteCategoriesService } from './institute-categories.service';

/**
 * Institute-category administration. Every route requires authentication, a still-active
 * account, and the `institute-categories.manage` grant — held by Super Admin alone, since the
 * Admin role is deliberately scoped to operational data rather than reference data.
 *
 * The unauthenticated read used by the public registration form lives in its own controller,
 * with its own response mapper, so the two can never drift into each other.
 */
@ApiTags('institute-categories')
@ApiCookieAuth()
@Controller('institute-categories')
@UseGuards(JwtAuthGuard, ActiveUserGuard, PermissionsGuard)
export class InstituteCategoriesController {
  constructor(private readonly categories: InstituteCategoriesService) {}

  @Get()
  @RequirePermissions('institute-categories.manage')
  @ApiOperation({ summary: 'List every institute category, including deactivated ones' })
  @ApiResponse({ status: 200, description: 'AdminInstituteCategory[]' })
  @ApiResponse({ status: 403, description: 'Missing institute-categories.manage grant' })
  list(): Promise<AdminInstituteCategory[]> {
    return this.categories.listForAdmin();
  }

  @Get(':id')
  @RequirePermissions('institute-categories.manage')
  @ApiOperation({ summary: 'Get one institute category with its questions' })
  @ApiResponse({ status: 200, description: 'AdminInstituteCategory' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  find(@Param('id', ParseUUIDPipe) id: string): Promise<AdminInstituteCategory> {
    return this.categories.findForAdmin(id);
  }

  @Post()
  @RequirePermissions('institute-categories.manage')
  @ApiOperation({ summary: 'Create a category together with its questions' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 409, description: 'A category with that code already exists' })
  create(
    @CurrentUser() actor: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateInstituteCategorySchema))
    dto: CreateInstituteCategoryRequestDto,
  ): Promise<AdminInstituteCategory> {
    return this.categories.create(dto, actor.sub);
  }

  @Patch(':id')
  @RequirePermissions('institute-categories.manage')
  @ApiOperation({
    summary: 'Update a category and its question list together',
    description:
      'Send the version you loaded. Omit `questions` to leave them untouched; send the full ' +
      'list to replace it — each question keeping its `id` also keeps its stored answers.',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'A question id does not belong to this category' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Someone else saved first, or the code is taken' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateInstituteCategorySchema))
    dto: UpdateInstituteCategoryRequestDto,
  ): Promise<AdminInstituteCategory> {
    return this.categories.update(id, dto, actor.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('institute-categories.manage')
  @ApiOperation({ summary: 'Activate or deactivate a category' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  setStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateCategoryStatusSchema)) dto: UpdateCategoryStatusDto,
  ): Promise<AdminInstituteCategory> {
    return this.categories.setActive(id, dto, actor.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('institute-categories.manage')
  @ApiOperation({
    summary: 'Delete a category permanently',
    description: 'Refused while any institute uses it — deactivate it instead.',
  })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category is in use' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
