import type { CategoryQuestionInput } from '@oses/types';

import {
  AnsweredQuestionChangeError,
  type CategoryQuestionRecord,
  DuplicateQuestionIdError,
  type QuestionMutationPlan,
  UnknownQuestionError,
} from './ports';

/**
 * Work out the difference between the question list a caller submitted and the rows already
 * stored, as a plan the repository applies in one transaction.
 *
 * The rule the whole module exists to keep: **an existing question's id is never rewritten.**
 * A submitted question carrying an `id` updates that row in place; one without an `id` becomes a
 * new row. Position is expressed by `sortOrder` (1-based, from the submitted order), which is
 * deliberately separate from identity — so reordering the list can never change what an
 * institute's stored answer refers to.
 *
 * Pure by design: no database, no clock, no framework. Inputs are assumed already validated and
 * normalised by the DTO layer (trimmed strings, option list matching the question type), so this
 * function only decides *what changes*, never *whether the values are well-formed*.
 *
 * @param existing  Rows currently stored for the category.
 * @param incoming  The list the caller wants the category to end up with.
 * @param answered  Ids of questions institutes have already answered — these are protected.
 * @throws {UnknownQuestionError}       a submitted id is not in this category
 * @throws {DuplicateQuestionIdError}   the same id was submitted twice
 * @throws {AnsweredQuestionChangeError} a change would invalidate stored answers
 */
export function reconcileQuestions(
  existing: readonly CategoryQuestionRecord[],
  incoming: readonly CategoryQuestionInput[],
  answered: ReadonlySet<string>,
): QuestionMutationPlan {
  const byId = new Map(existing.map((question) => [question.id, question]));
  const submitted = new Set<string>();
  const plan: QuestionMutationPlan = { insert: [], update: [], deactivate: [], remove: [] };

  incoming.forEach((question, index) => {
    const sortOrder = index + 1;
    const options = question.options ?? [];
    const required = question.required ?? false;

    if (question.id === undefined) {
      plan.insert.push({ text: question.text, type: question.type, required, options, sortOrder });
      return;
    }

    if (submitted.has(question.id)) throw new DuplicateQuestionIdError(question.id);
    const current = byId.get(question.id);
    if (!current) throw new UnknownQuestionError(question.id);
    submitted.add(question.id);

    if (answered.has(question.id)) {
      if (current.type !== question.type) {
        throw new AnsweredQuestionChangeError(
          question.id,
          `its type cannot change from "${current.type}" to "${question.type}"`,
        );
      }
      // Options are append-only once answered: withdrawing one would strand every answer
      // holding that value. Adding options is always safe.
      const withdrawn = current.options.filter((option) => !options.includes(option));
      if (withdrawn.length > 0) {
        throw new AnsweredQuestionChangeError(
          question.id,
          `these options cannot be removed: ${withdrawn.join(', ')}`,
        );
      }
    }

    plan.update.push({
      id: question.id,
      text: question.text,
      type: question.type,
      required,
      options,
      sortOrder,
      // Submitting a retired question puts it back on the form.
      isActive: true,
    });
  });

  for (const question of existing) {
    if (submitted.has(question.id)) continue;
    // Already retired and still omitted — leave it exactly as it is.
    if (!question.isActive) continue;
    if (answered.has(question.id)) plan.deactivate.push(question.id);
    else plan.remove.push(question.id);
  }

  return plan;
}
