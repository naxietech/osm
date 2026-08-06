import { questionTypeHasOptions } from '@oses/types';

import type { CategoryQuestionSummary, CategorySummary, InstituteAnswerRecord } from './ports';

/** A rejection an applicant can act on: what is wrong, and which question it is about. */
export interface AnswerProblem {
  questionId: string | null;
  message: string;
}

export type AnswerValidation =
  | { ok: true; answers: InstituteAnswerRecord[] }
  | { ok: false; problem: AnswerProblem };

interface SubmittedAnswer {
  questionId: string;
  values: string[];
}

/**
 * Check a registration's answers against the category that asked the questions, and return the
 * rows to store.
 *
 * A pure function with no repository of its own, so every rule below is testable without a
 * database — the same reason the categories module keeps its question reconciler separate.
 *
 * Two rules are worth calling out because they are decisions rather than mechanics:
 *
 * - **`file` questions cannot be answered at all.** There is no object storage in the API yet.
 *   Accepting an upload and keeping only its filename would look like it worked and quietly lose
 *   the document, so a category with a *required* file question refuses the whole registration,
 *   and an answer submitted for any file question is rejected outright.
 * - **Inactive questions are ignored, not rejected.** A question retired between the form loading
 *   and the applicant pressing submit is not their fault; their answer to it is dropped and the
 *   registration proceeds. Rejecting would strand a form nobody could ever submit.
 */
export function validateAnswers(
  category: CategorySummary,
  submitted: readonly SubmittedAnswer[] = [],
): AnswerValidation {
  const active = category.questions.filter((q) => q.isActive);
  const byId = new Map(active.map((q) => [q.id, q]));

  const blockingFile = active.find((q) => q.type === 'file' && q.required);
  if (blockingFile) {
    return {
      ok: false,
      problem: {
        questionId: blockingFile.id,
        message:
          `This category requires a file upload ("${blockingFile.text}"), which cannot be ` +
          'submitted yet. Ask the administrator to make that question optional or remove it.',
      },
    };
  }

  const seen = new Set<string>();
  const accepted: InstituteAnswerRecord[] = [];

  for (const answer of submitted) {
    if (seen.has(answer.questionId)) {
      return {
        ok: false,
        problem: { questionId: answer.questionId, message: 'This question is answered twice.' },
      };
    }
    seen.add(answer.questionId);

    const question = byId.get(answer.questionId);
    if (!question) {
      // Either the question belongs to a different category, or it has been retired. Both mean
      // the answer cannot be stored — but only the first is a caller error worth naming.
      if (category.questions.some((q) => q.id === answer.questionId)) continue;
      return {
        ok: false,
        problem: {
          questionId: answer.questionId,
          message: 'This question does not belong to the chosen category.',
        },
      };
    }

    const problem = checkOneAnswer(question, answer.values);
    if (problem) return { ok: false, problem: { questionId: question.id, message: problem } };

    if (answer.values.length > 0) {
      accepted.push({ questionId: question.id, values: [...answer.values] });
    }
  }

  const answered = new Set(accepted.map((a) => a.questionId));
  const missing = active.find((q) => q.required && q.type !== 'file' && !answered.has(q.id));
  if (missing) {
    return {
      ok: false,
      problem: { questionId: missing.id, message: `"${missing.text}" must be answered.` },
    };
  }

  return { ok: true, answers: accepted };
}

/** Returns the problem with one answer, or null when it is acceptable. */
function checkOneAnswer(
  question: CategoryQuestionSummary,
  values: readonly string[],
): string | null {
  if (question.type === 'file') {
    return 'Answers to file questions cannot be submitted yet.';
  }

  if (values.length === 0) {
    // An empty answer is only a problem when the question is required, and that is checked once
    // at the end against everything accepted — so it reads as "you missed this", not "this is
    // malformed", which is what an applicant actually did.
    return null;
  }

  if (questionTypeHasOptions(question.type)) {
    const allowed = new Set(question.options);
    const unknown = values.find((value) => !allowed.has(value));
    if (unknown) return `"${unknown}" is not one of the choices for this question.`;
    if (question.type !== 'checkbox' && values.length > 1) {
      return 'Only one choice may be selected for this question.';
    }
    if (new Set(values).size !== values.length) return 'The same choice is selected twice.';
    return null;
  }

  return values.length > 1 ? 'This question takes a single answer.' : null;
}
