import type { DataSource, EntityManager } from 'typeorm';

import type { CategoryQuestionType } from '@oses/types';

import { InstituteCategoryEntity, InstituteCategoryQuestionEntity } from '../entities';

interface SeedQuestion {
  text: string;
  type: CategoryQuestionType;
  required: boolean;
  options: string[];
}

interface SeedCategory {
  code: string;
  name: string;
  description: string;
  questions: SeedQuestion[];
}

/** The six standard categories from the TRD. Only School carries questions out of the box. */
const STANDARD_CATEGORIES: SeedCategory[] = [
  {
    code: 'SCH',
    name: 'School',
    description: 'Primary, middle and secondary schools',
    questions: [
      {
        text: 'Are you an ed-tech institute?',
        type: 'radio',
        required: true,
        options: ['Yes', 'No'],
      },
      {
        text: 'Are you a Nawaz Sharif School of Eminence?',
        type: 'radio',
        required: false,
        options: ['Yes', 'No'],
      },
    ],
  },
  {
    code: 'COL',
    name: 'College',
    description: 'Intermediate and degree colleges',
    questions: [],
  },
  { code: 'BRD', name: 'Board', description: 'Examination boards', questions: [] },
  { code: 'UNI', name: 'University', description: 'Degree-awarding universities', questions: [] },
  { code: 'ACD', name: 'Academy', description: 'Private coaching academies', questions: [] },
  {
    code: 'PECTA',
    name: 'PECTA',
    description: 'Punjab Educational & Coaching Trainers Association members',
    questions: [],
  },
];

export interface InstituteCategorySeedSummary {
  categoriesCreated: number;
  categoriesSkipped: number;
  questionsCreated: number;
}

/**
 * Plant the standard institute categories on a fresh database.
 *
 * Deliberately **insert-only**: unlike the Super Admin (whose credential is reconciled to `.env`
 * every run so a locked-out bootstrap account is always recoverable), categories are the user's
 * own data. Re-running `db:seed` never edits or removes an existing row, so an admin's work is
 * never undone.
 *
 * The idempotency key is **`code`**, which matters because `code` is itself admin-editable:
 *
 * - name, description, active flag or questions changed → matched by code, skipped entirely
 * - the whole category deleted → its code is free, so the standard row is re-created
 * - **a standard category's `code` changed** (e.g. `SCH` → `SCHOOL`) → the old code is free too,
 *   so re-seeding adds a fresh standard row alongside the admin's renamed one. Nothing is lost,
 *   but the count grows. Covered by a test so the behaviour is a decision, not a surprise.
 *
 * `ON CONFLICT DO NOTHING ... RETURNING id` makes the create-or-skip decision atomic, so two
 * seeds racing on an empty database cannot both insert, nor duplicate the questions.
 */
export async function seedInstituteCategories(
  dataSource: DataSource,
): Promise<InstituteCategorySeedSummary> {
  return dataSource.transaction(async (manager) => {
    const summary: InstituteCategorySeedSummary = {
      categoriesCreated: 0,
      categoriesSkipped: 0,
      questionsCreated: 0,
    };

    for (const category of STANDARD_CATEGORIES) {
      const categoryId = await insertIfAbsent(manager, category);
      if (!categoryId) {
        summary.categoriesSkipped += 1;
        continue;
      }

      summary.categoriesCreated += 1;
      summary.questionsCreated += await insertQuestions(manager, categoryId, category.questions);
    }

    return summary;
  });
}

/** Returns the new id, or `null` when a category with that code already existed. */
async function insertIfAbsent(
  manager: EntityManager,
  category: SeedCategory,
): Promise<string | null> {
  const result = await manager
    .createQueryBuilder()
    .insert()
    .into(InstituteCategoryEntity)
    .values({ code: category.code, name: category.name, description: category.description })
    .orIgnore()
    .returning('id')
    .execute();

  return (result.raw as Array<{ id: string }>)[0]?.id ?? null;
}

async function insertQuestions(
  manager: EntityManager,
  categoryId: string,
  questions: SeedQuestion[],
): Promise<number> {
  if (questions.length === 0) return 0;

  const repo = manager.getRepository(InstituteCategoryQuestionEntity);
  await repo.save(
    questions.map((question, index) =>
      repo.create({
        categoryId,
        text: question.text,
        type: question.type,
        required: question.required,
        options: question.options,
        sortOrder: index + 1,
      }),
    ),
  );
  return questions.length;
}
