/**
 * SUPERSEDED — the institute-category module is live. Use `institute-categories.service.ts`
 * (through `hooks/use-institute-categories`) for anything that reads or writes a category.
 *
 * This mock is kept only because `services/index.ts` re-exports it and modules that have not
 * been built yet may still read its seed array. Nothing here reaches the database, so a value
 * it returns is not what an admin sees on the live Categories screen.
 */
import {
  type CategoryQuestionInput,
  type CreateInstituteCategoryDto,
  type InstituteCategory,
  type InstituteCategoryQuestion,
  type UpdateInstituteCategoryDto,
  questionTypeHasOptions,
} from '@oses/types';

/** Build questions with stable, deterministic ids from the category id + input list. */
function toQuestions(
  categoryId: string,
  inputs: CategoryQuestionInput[] | undefined,
): InstituteCategoryQuestion[] {
  return (inputs ?? [])
    .filter((q) => q.text.trim().length > 0)
    .map((q, i) => ({
      id: `${categoryId}_q${i + 1}`,
      text: q.text.trim(),
      type: q.type,
      required: q.required ?? false,
      options: questionTypeHasOptions(q.type)
        ? (q.options ?? []).map((o) => o.trim()).filter((o) => o.length > 0)
        : [],
    }));
}

export const instituteCategories: InstituteCategory[] = [
  {
    id: 'cat_school',
    code: 'SCH',
    name: 'School',
    isActive: true,
    version: 1,
    questions: [
      {
        id: 'cat_school_q1',
        text: 'Are you an ed-tech institute?',
        type: 'radio',
        required: true,
        options: ['Yes', 'No'],
      },
      {
        id: 'cat_school_q2',
        text: 'Are you a Nawaz Sharif School of Eminence?',
        type: 'radio',
        required: false,
        options: ['Yes', 'No'],
      },
    ],
  },
  { id: 'cat_college', code: 'COL', name: 'College', isActive: true, version: 1, questions: [] },
  { id: 'cat_board', code: 'BRD', name: 'Board', isActive: true, version: 1, questions: [] },
  {
    id: 'cat_university',
    code: 'UNI',
    name: 'University',
    isActive: true,
    version: 1,
    questions: [],
  },
  { id: 'cat_academy', code: 'ACD', name: 'Academy', isActive: true, version: 1, questions: [] },
  { id: 'cat_pecta', code: 'PECTA', name: 'PECTA', isActive: true, version: 1, questions: [] },
];

export function listInstituteCategories(): InstituteCategory[] {
  return instituteCategories;
}

export function getInstituteCategory(id: string): InstituteCategory | undefined {
  return instituteCategories.find((c) => c.id === id);
}

let categoryCounter = instituteCategories.length;

export function createInstituteCategory(dto: CreateInstituteCategoryDto): InstituteCategory {
  categoryCounter += 1;
  const id = `cat_new_${categoryCounter}`;
  const category: InstituteCategory = {
    id,
    code: dto.code,
    name: dto.name,
    isActive: true,
    version: 1,
    questions: toQuestions(id, dto.questions),
    ...(dto.description ? { description: dto.description } : {}),
  };
  instituteCategories.push(category);
  return category;
}

/**
 * Two differences from the old mock, both forced by the live contract:
 *
 * - **`isActive` is not here.** Switching a category on or off is its own route, so it cannot
 *   ride along with an edit. Use {@link toggleInstituteCategoryActive}.
 * - **`description: null` clears it**, where `undefined` leaves it alone. Three states, not two.
 *
 * The `version` the DTO now carries is ignored by this mock — there is nothing to race against
 * in a single browser tab. The real API rejects a stale one with a 409, which is the behaviour
 * the screen has to learn to handle when it is wired up.
 */
export function updateInstituteCategory(
  id: string,
  dto: UpdateInstituteCategoryDto,
): InstituteCategory | undefined {
  const category = instituteCategories.find((c) => c.id === id);
  if (!category) return undefined;
  if (dto.code !== undefined) category.code = dto.code;
  if (dto.name !== undefined) category.name = dto.name;
  if (dto.description !== undefined) {
    if (dto.description === null) delete category.description;
    else category.description = dto.description;
  }
  if (dto.questions !== undefined) category.questions = toQuestions(id, dto.questions);
  category.version += 1;
  return category;
}

export function toggleInstituteCategoryActive(id: string): void {
  const category = instituteCategories.find((c) => c.id === id);
  if (category) category.isActive = !category.isActive;
}

/**
 * Remove a category outright. Only safe when no institute references it — callers must
 * check {@link countInstitutesInCategory} first. Returns whether a row was removed.
 */
export function deleteInstituteCategory(id: string): boolean {
  const index = instituteCategories.findIndex((c) => c.id === id);
  if (index === -1) return false;
  instituteCategories.splice(index, 1);
  return true;
}
