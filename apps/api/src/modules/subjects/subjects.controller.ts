import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { Subject } from '@oses/types';

import { ActiveUserGuard } from '../../auth/guards/active-user.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { AuthPrincipal } from '../../auth/principal';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import {
  type CreateSubjectRequestDto,
  CreateSubjectSchema,
  type ListSubjectsQueryDto,
  ListSubjectsQuerySchema,
  type UpdateSubjectRequestDto,
  UpdateSubjectSchema,
  type UpdateSubjectStatusDto,
  UpdateSubjectStatusSchema,
} from './dto';
import { SubjectsService } from './subjects.service';

/**
 * Subject administration. Every route requires authentication, a still-active account, and the
 * `subjects.manage` grant — held by Super Admin alone, since the Admin role is deliberately
 * scoped to operational data rather than reference data.
 *
 * There is no delete route on purpose: a subject is withdrawn with `PATCH :id/status`, so nothing
 * that references it can be orphaned.
 */
@ApiTags('subjects')
@ApiCookieAuth()
@Controller('subjects')
@UseGuards(JwtAuthGuard, ActiveUserGuard, PermissionsGuard)
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  @RequirePermissions('subjects.manage')
  @ApiOperation({ summary: 'List subjects, ordered by name' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    enum: ['true', 'false'],
    description: 'Pass `true` to return only active subjects — for pickers.',
  })
  @ApiResponse({ status: 200, description: 'Subject[]' })
  @ApiResponse({ status: 403, description: 'Missing subjects.manage grant' })
  list(
    @Query(new ZodValidationPipe(ListSubjectsQuerySchema)) query: ListSubjectsQueryDto,
  ): Promise<Subject[]> {
    return this.subjects.list(query.activeOnly);
  }

  @Get(':id')
  @RequirePermissions('subjects.manage')
  @ApiOperation({ summary: 'Get one subject' })
  @ApiResponse({ status: 200, description: 'Subject' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  find(@Param('id', ParseUUIDPipe) id: string): Promise<Subject> {
    return this.subjects.findOne(id);
  }

  @Post()
  @RequirePermissions('subjects.manage')
  @ApiOperation({ summary: 'Create a subject' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 409, description: 'A subject with that code already exists' })
  create(
    @CurrentUser() actor: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateSubjectSchema)) dto: CreateSubjectRequestDto,
  ): Promise<Subject> {
    return this.subjects.create(dto, actor.sub);
  }

  @Patch(':id')
  @RequirePermissions('subjects.manage')
  @ApiOperation({
    summary: 'Update a subject',
    description: 'Send whichever of `code` and `name` changed. Sending neither is a 400.',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Empty or unrecognised patch' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  @ApiResponse({ status: 409, description: 'That code is taken' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSubjectSchema)) dto: UpdateSubjectRequestDto,
  ): Promise<Subject> {
    return this.subjects.update(id, dto, actor.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('subjects.manage')
  @ApiOperation({
    summary: 'Activate or deactivate a subject',
    description: 'Deactivating is how a subject is withdrawn — there is no delete.',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  setStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSubjectStatusSchema)) dto: UpdateSubjectStatusDto,
  ): Promise<Subject> {
    return this.subjects.setActive(id, dto, actor.sub);
  }
}
