import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { PublicInstituteCategory } from './category-mapper';
import { InstituteCategoriesService } from './institute-categories.service';

/**
 * The one unauthenticated read in the API: the institute registration form is an open link, so
 * it must be able to draw its category picker and the questions behind it before anybody has an
 * account.
 *
 * Kept as a separate controller from the admin one on purpose. A single endpoint that "returns
 * more when you are logged in" is a branch, and branches get missed during a later refactor —
 * whereas a separate response mapper (`toPublicCategory`) is an explicit list of fields somebody
 * has to deliberately edit to widen. There is also no `:id` route here: an anonymous caller gets
 * the whole active list or nothing, so deactivated categories cannot be probed for.
 */
@ApiTags('public')
@Controller('public/institute-categories')
export class PublicInstituteCategoriesController {
  constructor(private readonly categories: InstituteCategoriesService) {}

  @Get()
  // Tighter than the global baseline: this route needs no credentials, so it must not become a
  // cheap way to hammer the database.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary: 'Active institute categories and their questions (no authentication)',
    description: 'Powers the public institute-registration form. Deactivated rows never appear.',
  })
  @ApiResponse({ status: 200, description: 'PublicInstituteCategory[]' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  list(): Promise<PublicInstituteCategory[]> {
    return this.categories.listPublic();
  }
}
