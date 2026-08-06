import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import {
  AUTH_ENTITIES,
  INSTITUTE_ENTITIES,
  REFERENCE_ENTITIES,
} from '../../persistence/typeorm/entities';
import { INSTITUTE_REPOSITORY_PROVIDERS } from '../../persistence/typeorm/repositories';
import { ApprovalService } from './approval.service';
import { InstitutesController } from './institutes.controller';
import { InstitutesService } from './institutes.service';
import { PublicInstitutesController } from './public-institutes.controller';

/**
 * Institute registration and approval.
 *
 * Three entity groups, because this module reads across all of them: its own tables, the
 * categories it validates a registration against, and `users` — both to answer "is this email
 * taken" and to switch an institute's accounts off when it is deactivated.
 *
 * Two controllers: the admin surface, and the open registration link. Separate files with
 * separate response mappers, so what an anonymous caller sees can never widen by accident.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([...INSTITUTE_ENTITIES, ...REFERENCE_ENTITIES, ...AUTH_ENTITIES]),
    AuthModule,
  ],
  controllers: [InstitutesController, PublicInstitutesController],
  providers: [InstitutesService, ApprovalService, ...INSTITUTE_REPOSITORY_PROVIDERS],
  exports: [InstitutesService, ApprovalService],
})
export class InstitutesModule {}
