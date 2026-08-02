import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { Subject } from '@oses/types';

import type {
  CreateSubjectRequestDto,
  UpdateSubjectRequestDto,
  UpdateSubjectStatusDto,
} from './dto';
import {
  SUBJECT_REPOSITORY,
  SubjectCodeAlreadyExistsError,
  type SubjectPatch,
  type SubjectRepository,
} from './ports';
import { toSubject } from './subject-mapper';

const NOT_FOUND = 'Subject not found';

/**
 * Subjects — the national subject/course list the curriculum, SLOs and exam papers point at.
 *
 * Every route that reaches here is gated by `@RequirePermissions('subjects.manage')`, which only
 * Super Admin holds. There is no public read: unlike institute categories, nothing anonymous
 * needs this list.
 *
 * Deliberately thin. There is no in-memory cache (nine rows behind an authenticated,
 * super-admin-only route is not a load problem worth the staleness) and no optimistic locking (a
 * subject is two editable scalar fields with no child rows, so last-write-wins is honest rather
 * than lossy).
 */
@Injectable()
export class SubjectsService {
  constructor(
    @Inject(SUBJECT_REPOSITORY)
    private readonly subjects: SubjectRepository,
  ) {}

  async list(activeOnly: boolean): Promise<Subject[]> {
    const records = await this.subjects.list({ activeOnly });
    return records.map(toSubject);
  }

  async findOne(id: string): Promise<Subject> {
    const record = await this.subjects.findById(id);
    if (!record) throw new NotFoundException(NOT_FOUND);
    return toSubject(record);
  }

  async create(dto: CreateSubjectRequestDto, actorId: string): Promise<Subject> {
    try {
      const created = await this.subjects.create({
        code: dto.code,
        name: dto.name,
        actorId,
      });
      return toSubject(created);
    } catch (err) {
      throw this.translate(err);
    }
  }

  async update(id: string, dto: UpdateSubjectRequestDto, actorId: string): Promise<Subject> {
    // Built key by key rather than spread, so a field the caller omitted stays omitted instead of
    // arriving as an explicit `undefined` the repository would have to re-filter.
    const patch: SubjectPatch = {};
    if (dto.code !== undefined) patch.code = dto.code;
    if (dto.name !== undefined) patch.name = dto.name;

    let updated;
    try {
      updated = await this.subjects.update(id, patch, actorId);
    } catch (err) {
      throw this.translate(err);
    }

    if (!updated) throw new NotFoundException(NOT_FOUND);
    return toSubject(updated);
  }

  /**
   * Activate or deactivate. Deactivating is how a subject is withdrawn — there is no delete, so
   * anything already pointing at it keeps resolving.
   */
  async setActive(id: string, dto: UpdateSubjectStatusDto, actorId: string): Promise<Subject> {
    const updated = await this.subjects.setActive(id, dto.isActive, actorId);
    if (!updated) throw new NotFoundException(NOT_FOUND);
    return toSubject(updated);
  }

  /** The domain error carries the detail; this only chooses the HTTP status that fits it. */
  private translate(err: unknown): unknown {
    if (err instanceof SubjectCodeAlreadyExistsError) return new ConflictException(err.message);
    return err;
  }
}
