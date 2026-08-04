import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import { ACADEMIC_ENTITIES } from '../../persistence/typeorm/entities';
import { CLASS_REPOSITORY_PROVIDERS } from '../../persistence/typeorm/repositories';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

/**
 * AuthModule is imported for the guards these routes rely on — it owns the user repository
 * `ActiveUserGuard` needs and the permission resolver `PermissionsGuard` needs.
 */
@Module({
  imports: [TypeOrmModule.forFeature(ACADEMIC_ENTITIES), AuthModule],
  controllers: [ClassesController],
  providers: [ClassesService, ...CLASS_REPOSITORY_PROVIDERS],
  exports: [ClassesService],
})
export class ClassesModule {}
