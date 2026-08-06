import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { AcademicClass } from '@oses/types';

import { ActiveUserGuard } from '../../auth/guards/active-user.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { AuthPrincipal } from '../../auth/principal';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { uuidParam } from '../../shared/pipes/uuid-param.pipe';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ClassesService } from './classes.service';
import {
  type CreateClassRequestDto,
  CreateClassSchema,
  type UpdateClassRequestDto,
  UpdateClassSchema,
  type UpdateClassStatusRequestDto,
  UpdateClassStatusSchema,
} from './dto';

/**
 * Class administration — the Class → Group → Subgroup hierarchy.
 *
 * Every route requires authentication, a still-active account, and the `levels.manage` grant,
 * which only Super Admin holds. The grant is deliberately not renamed to `classes.manage`:
 * it is already in the permission catalogue and already granted, and renaming it would mean
 * migrating live grants for the sake of a label.
 *
 * **There is no delete route, and there will not be one.** A class and everything in its tree
 * are deactivated with `PATCH /classes/:id/status` and by omission from a tree save. Student and
 * exam rows will point at these ids.
 */
@ApiTags('classes')
@ApiCookieAuth()
@Controller('classes')
@UseGuards(JwtAuthGuard, ActiveUserGuard, PermissionsGuard)
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  @RequirePermissions('levels.manage')
  @ApiOperation({
    summary: 'List classes in progression order, each with its full group tree',
    description:
      'The whole tree comes back on the list, not a count — a class carries a handful of ' +
      'groups, so the edit form opens from the row it was given rather than fetching again.',
  })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    description: 'Pass `true` to omit deactivated classes — for pickers.',
  })
  @ApiResponse({ status: 200, description: 'AcademicClass[]' })
  @ApiResponse({ status: 403, description: 'Missing levels.manage grant' })
  list(@Query('activeOnly') activeOnly?: string): Promise<AcademicClass[]> {
    return this.classes.list(activeOnly === 'true');
  }

  @Get(':id')
  @RequirePermissions('levels.manage')
  @ApiOperation({ summary: 'Get one class with its group tree' })
  @ApiResponse({ status: 200, description: 'AcademicClass' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  find(@Param('id', uuidParam('Class')) id: string): Promise<AcademicClass> {
    return this.classes.findById(id);
  }

  @Post()
  @RequirePermissions('levels.manage')
  @ApiOperation({
    summary: 'Create a class, optionally with its whole group tree',
    description: 'Group ids are rejected here — nothing exists yet for one to refer to.',
  })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 409, description: 'A class with that name already exists' })
  create(
    @CurrentUser() actor: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateClassSchema)) dto: CreateClassRequestDto,
  ): Promise<AcademicClass> {
    return this.classes.create(dto, actor.sub);
  }

  @Patch(':id')
  @RequirePermissions('levels.manage')
  @ApiOperation({
    summary: 'Update a class and its group tree together',
    description:
      'Send the version you loaded. Omit `groups` to leave the tree untouched; send the full ' +
      'tree to replace it — each node keeping its `id` keeps whatever points at it, and any ' +
      'stored node the tree does not mention is deactivated rather than deleted.',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({
    status: 400,
    description: 'A group id does not belong to this class, or sits at the wrong depth',
  })
  @ApiResponse({ status: 404, description: 'Class not found' })
  @ApiResponse({ status: 409, description: 'Someone else saved first, or the name is taken' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', uuidParam('Class')) id: string,
    @Body(new ZodValidationPipe(UpdateClassSchema)) dto: UpdateClassRequestDto,
  ): Promise<AcademicClass> {
    return this.classes.update(id, dto, actor.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('levels.manage')
  @ApiOperation({ summary: 'Activate or deactivate a class' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  setStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', uuidParam('Class')) id: string,
    @Body(new ZodValidationPipe(UpdateClassStatusSchema)) dto: UpdateClassStatusRequestDto,
  ): Promise<AcademicClass> {
    return this.classes.setActive(id, dto, actor.sub);
  }
}
