/**
 * REFERENCE PATTERN — SchoolsController
 * Every future controller follows this structure:
 * 1. @ApiTags for Swagger grouping
 * 2. @UseGuards(JwtAuthGuard) at class level
 * 3. @Roles() decorator on each route
 * 4. @UseGuards(RolesGuard) at class level
 * 5. Return types match ApiResponse<T> (handled by TransformInterceptor)
 * 6. DTOs validated by ZodValidationPipe at parameter level
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { School, SchoolListItem } from '@oses/types';
import { UserRole } from '@oses/types';

import { Roles } from '../../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateSchoolDtoSchema, type CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDtoSchema, type UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsService } from './schools.service';

@ApiTags('schools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @ApiOperation({ summary: 'List all schools' })
  @ApiResponse({ status: 200, description: 'Schools retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(): Promise<SchoolListItem[]> {
    return this.schoolsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @ApiOperation({ summary: 'Get a school by ID' })
  @ApiResponse({ status: 200, description: 'School retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'School not found' })
  async findOne(@Param('id') id: string): Promise<School> {
    return this.schoolsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new school' })
  @ApiResponse({ status: 201, description: 'School created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin only' })
  async create(
    @Body(new ZodValidationPipe(CreateSchoolDtoSchema)) dto: CreateSchoolDto,
  ): Promise<School> {
    return this.schoolsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a school' })
  @ApiResponse({ status: 200, description: 'School updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin only' })
  @ApiResponse({ status: 404, description: 'School not found' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSchoolDtoSchema)) dto: UpdateSchoolDto,
  ): Promise<School> {
    return this.schoolsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (deactivate) a school' })
  @ApiResponse({ status: 204, description: 'School deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin only' })
  @ApiResponse({ status: 404, description: 'School not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.schoolsService.remove(id);
  }
}
