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

import {
  INSTITUTE_STATUSES,
  type Institute,
  type InstituteDetail,
  type PaginatedInstitutes,
} from '@oses/types';

import { ActiveUserGuard } from '../../auth/guards/active-user.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { AuthPrincipal } from '../../auth/principal';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { type ApprovalResult, ApprovalService } from './approval.service';
import {
  type ApproveInstituteDto,
  ApproveInstituteSchema,
  type CreateInstituteRequestDto,
  CreateInstituteSchema,
  type ListInstitutesQueryDto,
  ListInstitutesSchema,
  type RejectInstituteDto,
  RejectInstituteSchema,
  type UpdateInstituteRequestDto,
  UpdateInstituteSchema,
  type UpdateInstituteStatusDto,
  UpdateInstituteStatusSchema,
} from './dto';
import { InstitutesService } from './institutes.service';

/**
 * Institute administration.
 *
 * Two grants, deliberately: the reads need `institutes.view`, everything that changes an
 * institute needs `institutes.manage`. An Admin holds only the first — they look institutes up
 * while working on students and exams, but approving, deactivating or deleting one is a Super
 * Admin decision.
 *
 * The two unauthenticated routes used by the open registration link live in their own controller
 * with their own response mapper, so the two audiences can never drift into each other.
 */
@ApiTags('institutes')
@ApiCookieAuth()
@Controller('institutes')
@UseGuards(JwtAuthGuard, ActiveUserGuard, PermissionsGuard)
export class InstitutesController {
  constructor(
    private readonly institutes: InstitutesService,
    private readonly approvals: ApprovalService,
  ) {}

  @Get()
  @RequirePermissions('institutes.view')
  @ApiOperation({
    summary: 'List institutes (paginated, newest first)',
    description:
      'All filters combine with AND, and `total` is narrowed by the same set as the page, so ' +
      '"showing 10 of 3" cannot happen. Soft-deleted institutes never appear.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'q', required: false, description: 'Search name, code or city' })
  @ApiQuery({ name: 'status', required: false, enum: INSTITUTE_STATUSES })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Exact category id (uuid)' })
  @ApiResponse({ status: 200, description: '{ items: AdminInstitute[], total }' })
  @ApiResponse({ status: 403, description: 'Missing institutes.view grant' })
  list(
    @Query(new ZodValidationPipe(ListInstitutesSchema)) query: ListInstitutesQueryDto,
  ): Promise<PaginatedInstitutes> {
    return this.institutes.listInstitutes(query);
  }

  @Get(':id')
  @RequirePermissions('institutes.view')
  @ApiOperation({
    summary: 'One institute, with its answers and any duplicate warning',
    description:
      'Carries `possibleDuplicates` — live institutes sharing this name and city. A prompt for ' +
      'the approver to look twice, never a block: two "Government High School" in different ' +
      'cities is normal.',
  })
  @ApiResponse({ status: 200, description: 'InstituteDetail' })
  @ApiResponse({ status: 404, description: 'Institute not found' })
  find(@Param('id', ParseUUIDPipe) id: string): Promise<InstituteDetail> {
    return this.institutes.getInstitute(id);
  }

  @Post()
  @RequirePermissions('institutes.manage')
  @ApiOperation({
    summary: 'Register an institute directly, with its login (lands approved)',
    description:
      'For a super admin entering one themselves. It lands `approved` with its numeric code ' +
      'already drawn — making the approver approve their own entry is ceremony, not a control. ' +
      'Supply `password` and the institute account is created in the same action, so it can ' +
      'sign in immediately; omit it and the record exists with no way in until an account is ' +
      'made by hand. The response message says which happened.',
  })
  @ApiResponse({ status: 201, description: 'Created — `{ institute, userId, message }`' })
  @ApiResponse({ status: 400, description: 'Unknown or inactive category, or an invalid answer' })
  @ApiResponse({
    status: 409,
    description: 'That institute code, or that contact email, is already registered',
  })
  create(
    @CurrentUser() actor: AuthPrincipal,
    @Body(new ZodValidationPipe(CreateInstituteSchema)) dto: CreateInstituteRequestDto,
  ): Promise<ApprovalResult> {
    return this.institutes.createByAdmin(dto, actor.sub);
  }

  @Patch(':id')
  @RequirePermissions('institutes.manage')
  @ApiOperation({
    summary: "Edit an institute's editable fields",
    description:
      'The institute code, category, question answers and numeric code are locked once an ' +
      'application exists — sending one answers 400 naming the field rather than accepting the ' +
      'request and ignoring it. The contact email stays editable: contact people change jobs. ' +
      'Changing it does not change any login; that is a separate account on the Users screen.',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'A locked field was sent, or the patch was empty' })
  @ApiResponse({ status: 404, description: 'Institute not found' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateInstituteSchema)) dto: UpdateInstituteRequestDto,
  ): Promise<Institute> {
    return this.institutes.updateInstitute(id, dto, actor.sub);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('institutes.manage')
  @ApiOperation({
    summary: 'Approve & Register — approve the institute and create its login',
    description:
      'One transaction, four steps: flip the status, draw the permanent numeric code, create ' +
      'the user, destroy the stored credential. Any failure rolls back all four. Approving a ' +
      'second time answers 409 rather than minting a second account. The password comes from ' +
      'the one the applicant chose; supply one only for an institute that has none on file.',
  })
  @ApiResponse({ status: 200, description: '{ institute, userId, message }' })
  @ApiResponse({ status: 400, description: 'A login was asked for but no password is on file' })
  @ApiResponse({ status: 404, description: 'Institute not found' })
  @ApiResponse({
    status: 409,
    description: 'No longer awaiting approval, or the contact email already has an account',
  })
  approve(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ApproveInstituteSchema)) dto: ApproveInstituteDto,
  ): Promise<ApprovalResult> {
    return this.approvals.approve(id, dto, actor.sub);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('institutes.manage')
  @ApiOperation({
    summary: 'Reject an application',
    description:
      'The row stays, with its reason, as the record of who applied and was turned away — but ' +
      'the institute code is freed, so the institute can apply again once the problem is fixed. ' +
      'The stored password is destroyed. There is no email service: telling them is a phone call.',
  })
  @ApiResponse({ status: 200, description: '{ institute, message }' })
  @ApiResponse({ status: 404, description: 'Institute not found' })
  @ApiResponse({ status: 409, description: 'No longer awaiting approval' })
  reject(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RejectInstituteSchema)) dto: RejectInstituteDto,
  ): Promise<{ institute: Institute; message: string }> {
    return this.approvals.reject(id, dto, actor.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('institutes.manage')
  @ApiOperation({
    summary: 'Deactivate or reactivate an institute',
    description:
      "Deactivating switches off the institute's accounts and revokes their sessions, releasing " +
      'evaluator allocations first. An exam already running is not disturbed; the block is on ' +
      'future use, and results are never touched. Reversible — and unlike DELETE it stays ' +
      'available once students and exams exist. Reactivating does not switch the accounts back ' +
      'on: an account may have been disabled for its own reasons.',
  })
  @ApiResponse({ status: 200, description: '{ institute, message }' })
  @ApiResponse({ status: 400, description: 'The application has not been approved yet' })
  @ApiResponse({ status: 404, description: 'Institute not found' })
  setStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateInstituteStatusSchema)) dto: UpdateInstituteStatusDto,
  ): Promise<{ institute: Institute; message: string }> {
    return this.approvals.setStatus(id, dto, actor.sub);
  }

  @Delete(':id')
  @RequirePermissions('institutes.manage')
  @ApiOperation({
    summary: 'Delete an institute (soft, and only while nothing is attached)',
    description:
      'For the case deactivation handles badly: approved by mistake, or a duplicate. Refused ' +
      'once any user, student or exam hangs off it — those records must stay reachable for ' +
      'years, so deactivation is the only way out for a working institute. The row is retained ' +
      'for the audit trail, but the institute code is freed for a correct entry.',
  })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Something is attached — the message says what' })
  @ApiResponse({ status: 404, description: 'Institute not found' })
  remove(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.institutes.deleteInstitute(id, actor.sub);
  }
}
