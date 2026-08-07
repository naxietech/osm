import type { DataSource } from 'typeorm';

/**
 * Clear the institute-category tables between tests, without touching accounts.
 *
 * Deliberately `DELETE` rather than `TRUNCATE ... CASCADE`. Categories used to be a leaf table,
 * so cascading was harmless. They are not any more: `institutes.category_id` references them,
 * and `users.institute_id` references institutes — so a cascading truncate of the two category
 * tables now reaches through institutes into **users and sessions**, silently signing out every
 * account the suite logged in during `beforeAll`. The symptom is every request answering 401
 * with nothing in the logs to explain it.
 *
 * Order matters. Institutes go first — their answers and stored credentials follow them through
 * `ON DELETE CASCADE` — and `users.institute_id` is cleared before that, because it has no
 * cascade of its own and would block the delete.
 */
export async function resetInstituteData(dataSource: DataSource): Promise<void> {
  await dataSource.query('update users set institute_id = null where institute_id is not null');
  await dataSource.query('delete from institutes');
  await dataSource.query('delete from institute_category_questions');
  await dataSource.query('delete from institute_categories');
}
