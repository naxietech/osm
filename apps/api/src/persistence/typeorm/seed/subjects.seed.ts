import type { DataSource } from 'typeorm';

import { SubjectEntity } from '../entities';

interface SeedSubject {
  code: string;
  name: string;
}

/**
 * The nine subjects the web app has been showing from its mock array since the start. Seeding
 * exactly these means the screen looks unchanged the day it starts reading the database.
 */
const STANDARD_SUBJECTS: SeedSubject[] = [
  { code: 'ENG', name: 'English' },
  { code: 'URD', name: 'Urdu' },
  { code: 'ISL', name: 'Islamiat' },
  { code: 'PAK', name: 'Pakistan Studies' },
  { code: 'MATH', name: 'Mathematics' },
  { code: 'PHY', name: 'Physics' },
  { code: 'CHEM', name: 'Chemistry' },
  { code: 'BIO', name: 'Biology' },
  { code: 'CS', name: 'Computer Science' },
];

export interface SubjectSeedSummary {
  created: number;
  skipped: number;
}

/**
 * Plant the standard subjects on a fresh database.
 *
 * **Insert-only**, for the same reason as the institute-category seed: subjects are the admin's
 * own data once the system is live, so re-running `db:seed` must never edit or remove a row
 * somebody changed on purpose.
 *
 * The idempotency key is `code`, which is itself admin-editable — so the same caveat applies:
 *
 * - a subject renamed or deactivated → matched by code, skipped entirely
 * - a subject deleted → impossible, there is no delete route
 * - a standard subject's **code** changed (`PHY` → `PHYS`) → the old code is free again, so a
 *   re-seed adds a fresh `PHY` alongside the renamed one. Nothing is lost, but the count grows.
 *
 * One statement with `ON CONFLICT DO NOTHING ... RETURNING id`, so two seeds racing on an empty
 * database cannot both insert. The rows that come back are exactly the ones this run created.
 */
export async function seedSubjects(dataSource: DataSource): Promise<SubjectSeedSummary> {
  const result = await dataSource
    .createQueryBuilder()
    .insert()
    .into(SubjectEntity)
    // A fresh copy every call, never `STANDARD_SUBJECTS` itself. TypeORM writes each generated
    // `id` back into the object it was given, so passing the module-level constant would leave
    // it carrying the first run's uuids — and the next run would re-send those ids, collide on
    // the primary key, and have `ON CONFLICT DO NOTHING` skip every row, including ones whose
    // code was free. That turns "re-seed after a subject was renamed" into a silent no-op.
    .values(STANDARD_SUBJECTS.map(({ code, name }) => ({ code, name })))
    .orIgnore()
    .returning('id')
    .execute();

  const created = (result.raw as Array<{ id: string }>).length;
  return { created, skipped: STANDARD_SUBJECTS.length - created };
}
