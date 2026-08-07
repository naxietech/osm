/**
 * Institute categories API — the super-admin taxonomy and its dynamic questions. Live.
 *
 * Three things differ from the mock this replaces, and each is a rule the server owns:
 *
 * - **Every update carries a `version`.** It is the copy the caller loaded, and the update
 *   applies only while it still matches. A second editor gets a 409 rather than silently
 *   overwriting the first.
 * - **`isActive` has its own route.** Switching a category on or off cannot ride along with an
 *   edit, so a save can never flip it by accident.
 * - **`description: null` clears it**, where omitting it leaves it alone. Three states, not two.
 *
 * A question sent without an `id` is read as new. Sending the stored id back is what keeps an
 * institute's answers pointing at the question they answered.
 */
import type {
  CreateInstituteCategoryDto,
  InstituteCategory,
  UpdateInstituteCategoryDto,
} from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

const { instituteCategories } = API_ENDPOINTS;

/** Every category, including deactivated ones — this is the management view. */
function listCategories(): Promise<InstituteCategory[]> {
  return apiRequest<InstituteCategory[]>(instituteCategories.list);
}

function getCategory(id: string): Promise<InstituteCategory> {
  return apiRequest<InstituteCategory>(instituteCategories.get(id));
}

/** A duplicate code comes back as a 409. */
function createCategory(dto: CreateInstituteCategoryDto): Promise<InstituteCategory> {
  return apiRequest<InstituteCategory>(instituteCategories.create, { method: 'POST', body: dto });
}

/**
 * Edit a category and its question list together.
 *
 * A 409 here means one of two different things and the message says which: the version no longer
 * matches (someone else saved first), or the new code is already taken.
 */
function updateCategory(id: string, dto: UpdateInstituteCategoryDto): Promise<InstituteCategory> {
  return apiRequest<InstituteCategory>(instituteCategories.update(id), {
    method: 'PATCH',
    body: dto,
  });
}

/** An explicit target state rather than a toggle, so a double submit is idempotent. */
function setActive(id: string, isActive: boolean): Promise<InstituteCategory> {
  return apiRequest<InstituteCategory>(instituteCategories.status(id), {
    method: 'PATCH',
    body: { isActive },
  });
}

/**
 * Remove a category outright. The API refuses with a 409 while any institute is filed under it —
 * including soft-deleted ones, whose rows still point at it.
 */
function deleteCategory(id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(instituteCategories.remove(id), { method: 'DELETE' });
}

export const instituteCategoriesService = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  setActive,
  deleteCategory,
};
