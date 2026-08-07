import type {
  InstituteCategory,
  InstituteCategoryQuestion,
  PublicInstituteCategory,
} from '@oses/types';

import type { CategoryQuestionRecord, InstituteCategoryRecord } from './ports';

/** The admin view — the shared shape exactly, `version` included. */
export type AdminInstituteCategory = InstituteCategory;

/** Re-exported so this module's callers keep one import for both views. */
export type { PublicInstituteCategory };

function toQuestion(question: CategoryQuestionRecord): InstituteCategoryQuestion {
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    required: question.required,
    options: question.options,
  };
}

/**
 * Retired questions are withheld from both views. Beyond being noise on the form, returning them
 * without an `isActive` flag would be actively harmful: the caller round-trips the list it was
 * given, so a retired question echoed back would be read as "put this one back on the form".
 */
function activeQuestions(record: InstituteCategoryRecord): InstituteCategoryQuestion[] {
  return record.questions.filter((question) => question.isActive).map(toQuestion);
}

export function toAdminCategory(record: InstituteCategoryRecord): AdminInstituteCategory {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    ...(record.description !== null ? { description: record.description } : {}),
    isActive: record.isActive,
    version: record.version,
    questions: activeQuestions(record),
  };
}

/**
 * Every field that leaves the API anonymously is named here, one by one. The database row is
 * never spread or returned directly — so a column added later (an internal note, a client id, a
 * counter) cannot reach the public unless somebody deliberately adds it to this list.
 */
export function toPublicCategory(record: InstituteCategoryRecord): PublicInstituteCategory {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    ...(record.description !== null ? { description: record.description } : {}),
    questions: activeQuestions(record),
  };
}
