import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import { SubjectEntity } from '../../persistence/typeorm/entities';
import { SUBJECT_REPOSITORY_PROVIDERS } from '../../persistence/typeorm/repositories';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

/**
 * AuthModule is imported for the guards every route relies on — it owns the user repository
 * `ActiveUserGuard` needs and the permission resolver `PermissionsGuard` needs.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SubjectEntity]), AuthModule],
  controllers: [SubjectsController],
  providers: [SubjectsService, ...SUBJECT_REPOSITORY_PROVIDERS],
  exports: [SubjectsService],
})
export class SubjectsModule {}
