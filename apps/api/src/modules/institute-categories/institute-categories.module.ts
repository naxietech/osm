import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import { INSTITUTE_ENTITIES, REFERENCE_ENTITIES } from '../../persistence/typeorm/entities';
import { INSTITUTE_CATEGORY_REPOSITORY_PROVIDERS } from '../../persistence/typeorm/repositories';
import { InstituteCategoriesController } from './institute-categories.controller';
import { InstituteCategoriesService } from './institute-categories.service';
import { PublicInstituteCategoriesController } from './public-institute-categories.controller';

/**
 * AuthModule is imported for the guards the admin routes rely on — it owns the user repository
 * `ActiveUserGuard` needs and the permission resolver `PermissionsGuard` needs.
 *
 * `INSTITUTE_ENTITIES` is registered because `CATEGORY_REFERENCE_PROBE` now resolves to a real
 * implementation that reads institutes and their answers — the placeholder it replaced needed no
 * tables at all, which is exactly why it could answer "nothing references this".
 */
@Module({
  imports: [TypeOrmModule.forFeature([...REFERENCE_ENTITIES, ...INSTITUTE_ENTITIES]), AuthModule],
  controllers: [InstituteCategoriesController, PublicInstituteCategoriesController],
  providers: [InstituteCategoriesService, ...INSTITUTE_CATEGORY_REPOSITORY_PROVIDERS],
  exports: [InstituteCategoriesService],
})
export class InstituteCategoriesModule {}
