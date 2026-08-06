import { type DataSource, type EntityManager, IsNull } from 'typeorm';

import { InstitutionType, Province } from '@oses/types';

import { SYSTEM_ROLE_IDS } from '../../../rbac/system-roles';
import {
  InstituteCategoryEntity,
  InstituteCategoryQuestionEntity,
  InstituteEntity,
  InstituteQuestionAnswerEntity,
  UserEntity,
} from '../entities';

/** The category the demo institute is filed under, matched by the code the category seed plants. */
const DEMO_CATEGORY_CODE = 'SCH';

/** Idempotency key. Nothing else in the seed depends on this value. */
const DEMO_INSTITUTE_CODE = 'DEMO-001';

const DEMO_INSTITUTE = {
  instituteCode: DEMO_INSTITUTE_CODE,
  instituteName: 'Demo Public High School',
  branch: 'Main Campus',
  institutionType: InstitutionType.GOVERNMENT,
  address: '1 Mall Road',
  city: 'Lahore',
  province: Province.PUNJAB,
  postalCode: '54000',
  contactPersonName: 'Demo Principal',
  contactPersonDesignation: 'Principal',
  contactEmail: 'principal@demo-institute.example',
  contactPhone: '+92-42-0000000',
} as const;

export interface InstituteSeedSummary {
  created: boolean;
  /** Null when the row already existed, or when the demo category is missing. */
  numericCode: number | null;
  answersCreated: number;
  usersRelinked: number;
  skippedReason: string | null;
}

/**
 * Plant one approved demo institute, so a fresh database has a real institute to point at.
 *
 * **Insert-only**, like the categories seed: re-running never edits or removes an existing row,
 * so an admin's own edits are never undone. The idempotency key is `institute_code`.
 *
 * Unlike the categories seed this checks for the row before inserting rather than leaning on
 * `ON CONFLICT DO NOTHING`. The reason is the numeric code: it comes from a sequence, and
 * Postgres evaluates the insert's expressions before it notices a conflict, so the atomic form
 * would burn a sequence value on every single seed run. Gaps are harmless in principle — a
 * numeric code is never reused by design — but growing them on every `pnpm db:seed` is noise. A
 * CLI seed is run serially, and the unique index still catches a genuine race.
 *
 * It also **re-links orphaned institute users**. The Institutes1758000000000 migration clears
 * every `users.institute_id`, because the values it found were frontend mock ids pointing at
 * nothing. That leaves any Institute-role account with no institute — able to sign in and see
 * nothing, with no clue why. Pointing those at the demo institute puts a dev database back into
 * a working state. It touches only accounts whose institute is already null, so it can never
 * move a user that has been linked properly.
 */
export async function seedInstitutes(dataSource: DataSource): Promise<InstituteSeedSummary> {
  return dataSource.transaction(async (manager) => {
    const summary: InstituteSeedSummary = {
      created: false,
      numericCode: null,
      answersCreated: 0,
      usersRelinked: 0,
      skippedReason: null,
    };

    const category = await manager
      .getRepository(InstituteCategoryEntity)
      .findOne({ where: { code: DEMO_CATEGORY_CODE } });

    if (!category) {
      // The category seed runs first, so this only happens if an admin renamed or removed the
      // standard School row. Skipping beats crashing the whole seed over demo data.
      summary.skippedReason = `No institute category with code "${DEMO_CATEGORY_CODE}" — demo institute skipped.`;
      return summary;
    }

    const institutes = manager.getRepository(InstituteEntity);
    const existing = await institutes.findOne({
      where: { instituteCode: DEMO_INSTITUTE_CODE },
      select: ['id'],
    });

    const instituteId = existing?.id ?? (await insertDemoInstitute(manager, category.id, summary));
    if (!existing) {
      summary.answersCreated = await answerCategoryQuestions(manager, instituteId, category.id);
    }

    summary.usersRelinked = await relinkOrphanedInstituteUsers(manager, instituteId);
    return summary;
  });
}

async function insertDemoInstitute(
  manager: EntityManager,
  categoryId: string,
  summary: InstituteSeedSummary,
): Promise<string> {
  const now = new Date();
  const rows = await manager.query<Array<{ nextval: number }>>(
    `select nextval('institute_numeric_code_seq')::integer as nextval`,
  );
  const nextval = rows[0]?.nextval;
  if (nextval === undefined) throw new Error('institute_numeric_code_seq returned no value');

  const result = await manager
    .createQueryBuilder()
    .insert()
    .into(InstituteEntity)
    .values({
      ...DEMO_INSTITUTE,
      categoryId,
      numericCode: nextval,
      status: 'approved',
      registrationSource: 'admin',
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning('id')
    .execute();

  summary.created = true;
  summary.numericCode = nextval;
  return (result.raw as Array<{ id: string }>)[0]!.id;
}

/**
 * Answer every question the demo institute's category asks. An approved institute with an
 * unanswered *required* question is data that could not have come through the real flow, and
 * seeding an impossible state is worse than the small inconvenience of the resulting
 * `ON DELETE RESTRICT` — which is the protection working, not a bug.
 */
async function answerCategoryQuestions(
  manager: EntityManager,
  instituteId: string,
  categoryId: string,
): Promise<number> {
  const questions = await manager
    .getRepository(InstituteCategoryQuestionEntity)
    .find({ where: { categoryId, isActive: true }, order: { sortOrder: 'ASC' } });

  const answerable = questions.filter((q) => q.type !== 'file');
  if (answerable.length === 0) return 0;

  const repo = manager.getRepository(InstituteQuestionAnswerEntity);
  await repo.insert(
    answerable.map((question) => ({
      instituteId,
      questionId: question.id,
      values: [demoAnswerFor(question)],
      createdAt: new Date(),
    })),
  );
  return answerable.length;
}

/** First option for a choice question, a fixed sentence for free text. */
function demoAnswerFor(question: InstituteCategoryQuestionEntity): string {
  return question.options[0] ?? 'Seeded demo answer';
}

async function relinkOrphanedInstituteUsers(
  manager: EntityManager,
  instituteId: string,
): Promise<number> {
  const result = await manager
    .getRepository(UserEntity)
    .update(
      { roleId: SYSTEM_ROLE_IDS.institute, instituteId: IsNull(), deletedAt: IsNull() },
      { instituteId, updatedAt: new Date() },
    );
  return result.affected ?? 0;
}
