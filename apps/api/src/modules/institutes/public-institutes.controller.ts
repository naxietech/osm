import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { AvailabilityResult, RegistrationReceipt } from '@oses/types';

import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import {
  type CheckAvailabilityDto,
  CheckAvailabilitySchema,
  type RegisterInstituteRequestDto,
  RegisterInstituteSchema,
} from './dto';
import { InstitutesService } from './institutes.service';

/**
 * The open registration link — two routes, no authentication.
 *
 * A separate controller from the admin one, and with its own response mapper, for the same reason
 * the categories module has two: an endpoint that "returns more when you are logged in" is a
 * branch, and branches get missed in a later refactor. Here there is no branch to miss, and
 * nothing in this file can return an institute record.
 *
 * **Submitting creates nothing but a queue entry.** No login, no permission, no access, until a
 * super admin approves it. That is what makes an anonymous write route acceptable at all.
 */
@ApiTags('public')
@Controller('public/institutes')
export class PublicInstitutesController {
  constructor(private readonly institutes: InstitutesService) {}

  @Post('check-availability')
  @HttpCode(HttpStatus.OK)
  // Tighter than the global baseline, and tighter than the category read: this is a probe, so
  // the limit is what keeps it from becoming a way to enumerate codes and addresses in bulk.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Whether an institute code and/or email is free (no authentication)',
    description:
      'Powers the step-boundary check on the registration form, so an applicant is told before ' +
      'filling in fifteen more fields. POST rather than GET on purpose: an email in a query ' +
      'string would land in server logs and browser history, which NFR-SEC-5 forbids. Answers ' +
      'two booleans and nothing else — never the institute holding the code, never whose ' +
      'account owns the address. A field that was not asked about answers null.',
  })
  @ApiResponse({ status: 200, description: '{ codeAvailable, emailAvailable }' })
  @ApiResponse({ status: 400, description: 'Neither field was supplied' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  checkAvailability(
    @Body(new ZodValidationPipe(CheckAvailabilitySchema)) dto: CheckAvailabilityDto,
  ): Promise<AvailabilityResult> {
    return this.institutes.checkAvailability(dto);
  }

  @Post()
  // The strictest limit in the API. This route hashes a password with argon2id, which is
  // deliberately slow (~100ms) — that cost is the thing an attacker would aim at, so the limit
  // matters more here than on any read.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Register an institute (no authentication)',
    description:
      'Creates one pending application and nothing else. The chosen password is hashed on ' +
      'arrival and held apart from the institute record until a super admin approves it. The ' +
      'response carries four fields — the institute code among them, which is what the ' +
      'applicant quotes when they phone to ask what happened.',
  })
  @ApiResponse({ status: 201, description: 'RegistrationReceipt' })
  @ApiResponse({
    status: 400,
    description: 'Unknown or inactive category, a required answer missing, or a file question',
  })
  @ApiResponse({ status: 409, description: 'That institute code is already registered' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  register(
    @Body(new ZodValidationPipe(RegisterInstituteSchema)) dto: RegisterInstituteRequestDto,
  ): Promise<RegistrationReceipt> {
    return this.institutes.register(dto);
  }
}
