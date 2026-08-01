import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import { REFERENCE_ENTITIES } from '../../persistence/typeorm/entities';
import { INSTITUTE_CATEGORY_REPOSITORY_PROVIDERS } from '../../persistence/typeorm/repositories';
import { InstituteCategoriesController } from './institute-categories.controller';
import { InstituteCategoriesService } from './institute-categories.service';
import { PublicInstituteCategoriesController } from './public-institute-categories.controller';

/**
 * AuthModule is imported for the guards the admin routes rely on — it owns the user repository
 * `ActiveUserGuard` needs and the permission resolver `PermissionsGuard` needs.
 */
@Module({
  imports: [TypeOrmModule.forFeature(REFERENCE_ENTITIES), AuthModule],
  controllers: [InstituteCategoriesController, PublicInstituteCategoriesController],
  providers: [InstituteCategoriesService, ...INSTITUTE_CATEGORY_REPOSITORY_PROVIDERS],
  exports: [InstituteCategoriesService],
})
export class InstituteCategoriesModule {}
