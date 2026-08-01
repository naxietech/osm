import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  type AdminInstituteCategory,
  type PublicInstituteCategory,
  toAdminCategory,
  toPublicCategory,
} from './category-mapper';
import type {
  CreateInstituteCategoryRequestDto,
  UpdateCategoryStatusDto,
  UpdateInstituteCategoryRequestDto,
} from './dto';
import {
  AnsweredQuestionChangeError,
  CATEGORY_REFERENCE_PROBE,
  CategoryCodeAlreadyExistsError,
  type CategoryPatch,
  type CategoryReferenceProbe,
  DuplicateQuestionIdError,
  INSTITUTE_CATEGORY_REPOSITORY,
  type InstituteCategoryRepository,
  type QuestionMutationPlan,
  UnknownQuestionError,
} from './ports';
import { reconcileQuestions } from './question-reconciler';

/** No question changes — used when a caller omits `questions` entirely from an update. */
const NO_QUESTION_CHANGES: QuestionMutationPlan = {
  insert: [],
  update: [],
  deactivate: [],
  remove: [],
};

const PUBLIC_CACHE_TTL_MS = 60_000;

interface PublicCache {
  at: number;
  value: PublicInstituteCategory[];
}

/**
 * Institute categories — the super-admin taxonomy institutes are classified by, and the dynamic
 * questions each category asks at registration.
 *
 * Every admin route that reaches here is gated by `@RequirePermissions('institute-categories.manage')`.
 * The public read is deliberately separate and unauthenticated.
 */
@Injectable()
export class InstituteCategoriesService {
  /**
   * The public list is read on every visit to the registration link and changes a handful of
   * times a year, so it is held in memory and dropped on any write. Deliberately in-process
   * rather than Redis: it is one small object rebuilt by a single query, and the TTL bounds
   * staleness if a second API node ever serves the write.
   */
  private publicCache: PublicCache | null = null;

  /**
   * The load currently in progress, if any. Without this, a cold cache under real traffic lets
   * every simultaneous visitor start its own identical query — the classic stampede, and this is
   * precisely the endpoint exposed to uncontrolled fan-out.
   */
  private inFlight: Promise<PublicInstituteCategory[]> | null = null;

  /**
   * Bumped on every write. A load that started before a write must not publish what it read
   * afterwards, or an edit could be undone by an in-flight query completing a moment later.
   */
  private generation = 0;

  constructor(
    @Inject(INSTITUTE_CATEGORY_REPOSITORY)
    private readonly categories: InstituteCategoryRepository,
    @Inject(CATEGORY_REFERENCE_PROBE)
    private readonly references: CategoryReferenceProbe,
  ) {}

  async listForAdmin(): Promise<AdminInstituteCategory[]> {
    const records = await this.categories.list({ activeOnly: false });
    return records.map(toAdminCategory);
  }

  async findForAdmin(id: string): Promise<AdminInstituteCategory> {
    const record = await this.categories.findById(id);
    if (!record) throw new NotFoundException('Institute category not found');
    return toAdminCategory(record);
  }

  /** Active categories and their active questions, for the public registration form. */
  async listPublic(): Promise<PublicInstituteCategory[]> {
    const cached = this.publicCache;
    if (cached && Date.now() - cached.at < PUBLIC_CACHE_TTL_MS) return cached.value;

    this.inFlight ??= this.loadPublic();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async loadPublic(): Promise<PublicInstituteCategory[]> {
    const generation = this.generation;
    const records = await this.categories.list({ activeOnly: true });
    // Frozen because the array is handed to every caller: one accidental in-place `sort()`
    // downstream would otherwise corrupt what everybody else is served.
    const value = Object.freeze(records.map(toPublicCategory)) as PublicInstituteCategory[];

    if (generation === this.generation) this.publicCache = { at: Date.now(), value };
    return value;
  }

  async create(
    dto: CreateInstituteCategoryRequestDto,
    actorId: string,
  ): Promise<AdminInstituteCategory> {
    const questions = (dto.questions ?? []).map((question, index) => ({
      text: question.text,
      type: question.type,
      required: question.required ?? false,
      options: question.options ?? [],
      sortOrder: index + 1,
    }));

    try {
      const created = await this.categories.create({
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        questions,
        actorId,
      });
      this.invalidatePublicCache();
      return toAdminCategory(created);
    } catch (err) {
      throw this.translate(err);
    }
  }

  /**
   * Updates the category and its question list together, in one transaction. Omitting
   * `questions` leaves the stored list alone; sending it replaces the list by comparison, so
   * every question that keeps its id keeps every answer already stored against it.
   */
  async update(
    id: string,
    dto: UpdateInstituteCategoryRequestDto,
    actorId: string,
  ): Promise<AdminInstituteCategory> {
    const existing = await this.categories.findById(id);
    if (!existing) throw new NotFoundException('Institute category not found');

    const plan =
      dto.questions === undefined
        ? NO_QUESTION_CHANGES
        : await this.planQuestionChanges(existing.questions, dto.questions);

    const patch: CategoryPatch = {};
    if (dto.code !== undefined) patch.code = dto.code;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;

    let outcome;
    try {
      outcome = await this.categories.applyUpdate({
        id,
        expectedVersion: dto.version,
        patch,
        plan,
        actorId,
      });
    } catch (err) {
      throw this.translate(err);
    }

    switch (outcome.outcome) {
      case 'not-found':
        throw new NotFoundException('Institute category not found');
      case 'version-conflict':
        throw new ConflictException(
          'This category was changed by someone else. Reload it and try again.',
        );
      case 'updated':
        this.invalidatePublicCache();
        return toAdminCategory(outcome.category);
    }
  }

  async setActive(
    id: string,
    dto: UpdateCategoryStatusDto,
    actorId: string,
  ): Promise<AdminInstituteCategory> {
    const updated = await this.categories.setActive(id, dto.isActive, actorId);
    if (!updated) throw new NotFoundException('Institute category not found');
    this.invalidatePublicCache();
    return toAdminCategory(updated);
  }

  /**
   * Hard delete, allowed only while nothing references the category. Switching it off is the
   * normal way to withdraw one — an institute already classified under it must not lose its
   * classification.
   */
  async remove(id: string): Promise<void> {
    if (await this.references.isCategoryInUse(id)) {
      throw new ConflictException(
        'This category is in use by one or more institutes. Deactivate it instead of deleting it.',
      );
    }

    const removed = await this.categories.remove(id);
    if (!removed) throw new NotFoundException('Institute category not found');
    this.invalidatePublicCache();
  }

  private async planQuestionChanges(
    existing: Parameters<typeof reconcileQuestions>[0],
    incoming: NonNullable<UpdateInstituteCategoryRequestDto['questions']>,
  ): Promise<QuestionMutationPlan> {
    const answered = await this.references.questionsWithAnswers(existing.map((q) => q.id));
    try {
      return reconcileQuestions(existing, incoming, answered);
    } catch (err) {
      throw this.translate(err);
    }
  }

  /** Domain errors carry the detail; this only chooses the HTTP status that fits each one. */
  private translate(err: unknown): unknown {
    if (err instanceof CategoryCodeAlreadyExistsError) return new ConflictException(err.message);
    if (err instanceof AnsweredQuestionChangeError) return new ConflictException(err.message);
    if (err instanceof UnknownQuestionError) return new BadRequestException(err.message);
    if (err instanceof DuplicateQuestionIdError) return new BadRequestException(err.message);
    return err;
  }

  private invalidatePublicCache(): void {
    this.publicCache = null;
    this.generation += 1;
  }
}
