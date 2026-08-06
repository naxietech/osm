import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import type { CategoryReferenceProbe } from '../../../modules/institute-categories/ports';
import type {
  AccountLookup,
  CategoryLookup,
  CategorySummary,
  InstituteCredentialRepository,
  InstituteDependantCounts,
  InstituteDependants,
} from '../../../modules/institutes/ports';
import {
  InstituteCategoryEntity,
  InstituteCredentialEntity,
  InstituteEntity,
  InstituteQuestionAnswerEntity,
  UserEntity,
} from '../entities';

/** The slice of a category the institutes module needs to validate a registration. */
@Injectable()
export class TypeOrmCategoryLookup implements CategoryLookup {
  constructor(
    @InjectRepository(InstituteCategoryEntity)
    private readonly categories: Repository<InstituteCategoryEntity>,
  ) {}

  async findById(categoryId: string): Promise<CategorySummary | null> {
    const category = await this.categories.findOne({
      where: { id: categoryId },
      relations: { questions: true },
    });
    if (!category) return null;
    return {
      id: category.id,
      isActive: category.isActive,
      questions: (category.questions ?? []).map((question) => ({
        id: question.id,
        text: question.text,
        type: question.type,
        required: question.required,
        options: question.options,
        isActive: question.isActive,
      })),
    };
  }
}

/** Whether an email already belongs to a live account. Deleted accounts keep their address. */
@Injectable()
export class TypeOrmAccountLookup implements AccountLookup {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  async isEmailTaken(email: string): Promise<boolean> {
    // Soft-deleted users are counted: their email stays reserved, exactly as the users module
    // promises. Freeing it would let a new account inherit a former holder's audit trail.
    const count = await this.users.count({ where: { email } });
    return count > 0;
  }
}

@Injectable()
export class TypeOrmInstituteCredentialRepository implements InstituteCredentialRepository {
  constructor(
    @InjectRepository(InstituteCredentialEntity)
    private readonly credentials: Repository<InstituteCredentialEntity>,
  ) {}

  async find(instituteId: string): Promise<string | null> {
    const row = await this.credentials.findOne({ where: { instituteId } });
    return row?.passwordHash ?? null;
  }

  async remove(instituteId: string): Promise<void> {
    await this.credentials.delete({ instituteId });
  }
}

/**
 * Everything hanging off an institute.
 *
 * **Only the user half is real.** `students`, `exams` and evaluator allocations have no tables
 * yet, so those methods truthfully report nothing and do nothing. The interface, its call order
 * and the rules built on it are live and tested — when those modules land, filling in a method
 * switches the protection on, rather than requiring cascade rules to be retrofitted onto a table
 * already carrying a million rows.
 */
@Injectable()
export class TypeOrmInstituteDependants implements InstituteDependants {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  async count(instituteId: string): Promise<InstituteDependantCounts> {
    const users = await this.users.count({ where: { instituteId, deletedAt: IsNull() } });
    return { users, students: 0, exams: 0 };
  }

  async deactivateUsers(instituteId: string, reason: string): Promise<number> {
    void reason;
    const result = await this.users.update(
      { instituteId, deletedAt: IsNull() },
      { status: 'deactivate', updatedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /** Placeholder — must run before {@link deactivateEvaluators} once both are real. */
  releaseAllocations(instituteId: string): Promise<number> {
    void instituteId;
    return Promise.resolve(0);
  }

  deactivateEvaluators(instituteId: string): Promise<number> {
    void instituteId;
    return Promise.resolve(0);
  }

  /** Placeholder. Will need batching — an institute can hold hundreds of thousands of students. */
  deactivateStudents(instituteId: string): Promise<number> {
    void instituteId;
    return Promise.resolve(0);
  }
}

/**
 * The real {@link CategoryReferenceProbe}, replacing the placeholder that always answered "no
 * references".
 *
 * Module 1 shipped its retire-instead-of-delete rules against an implementation that could not
 * find anything, because institutes did not exist. They do now, so those rules start protecting
 * real answers — no rule changed, only this class.
 */
@Injectable()
export class TypeOrmCategoryReferenceProbe implements CategoryReferenceProbe {
  constructor(
    @InjectRepository(InstituteQuestionAnswerEntity)
    private readonly answers: Repository<InstituteQuestionAnswerEntity>,
    @InjectRepository(InstituteEntity)
    private readonly institutes: Repository<InstituteEntity>,
  ) {}

  async questionsWithAnswers(questionIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (questionIds.length === 0) return new Set<string>();
    // One query for the whole batch. A per-question call would be an N+1 on every category save.
    const rows = await this.answers
      .createQueryBuilder('a')
      .select('distinct a.question_id', 'question_id')
      .where({ questionId: In([...questionIds]) })
      .getRawMany<{ question_id: string }>();
    return new Set(rows.map((row) => row.question_id));
  }

  async isCategoryInUse(categoryId: string): Promise<boolean> {
    // Soft-deleted institutes still count. Their rows keep pointing at the category, so removing
    // it would break the record we deliberately kept.
    const count = await this.institutes.count({ where: { categoryId } });
    return count > 0;
  }
}
