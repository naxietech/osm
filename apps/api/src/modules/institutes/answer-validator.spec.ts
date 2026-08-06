import { validateAnswers } from './answer-validator';
import type { CategoryQuestionSummary, CategorySummary } from './ports';

function question(over: Partial<CategoryQuestionSummary> = {}): CategoryQuestionSummary {
  return {
    id: 'q1',
    text: 'Are you an ed-tech institute?',
    type: 'radio',
    required: false,
    options: ['Yes', 'No'],
    isActive: true,
    ...over,
  };
}

function category(questions: CategoryQuestionSummary[]): CategorySummary {
  return { id: 'cat1', isActive: true, questions };
}

/** The problem message, or null when the submission was accepted. */
function problemOf(result: ReturnType<typeof validateAnswers>): string | null {
  return result.ok ? null : result.problem.message;
}

describe('validateAnswers', () => {
  describe('file questions', () => {
    it('refuses the whole registration when a required file question exists', () => {
      const result = validateAnswers(
        category([question({ type: 'file', required: true, options: [], text: 'Upload charter' })]),
        [],
      );
      expect(problemOf(result)).toMatch(/requires a file upload/i);
      expect(problemOf(result)).toContain('Upload charter');
    });

    it('names the administrator action, because the applicant cannot fix it themselves', () => {
      const result = validateAnswers(
        category([question({ type: 'file', required: true, options: [] })]),
        [],
      );
      expect(problemOf(result)).toMatch(/optional or remove it/i);
    });

    it('allows an optional file question, as long as nothing is submitted for it', () => {
      const result = validateAnswers(
        category([question({ id: 'f1', type: 'file', required: false, options: [] })]),
        [],
      );
      expect(result.ok).toBe(true);
    });

    it('rejects an answer submitted for a file question', () => {
      const result = validateAnswers(
        category([question({ id: 'f1', type: 'file', required: false, options: [] })]),
        [{ questionId: 'f1', values: ['charter.pdf'] }],
      );
      expect(problemOf(result)).toMatch(/file questions cannot be submitted/i);
    });
  });

  describe('required questions', () => {
    it('refuses when a required question has no answer', () => {
      const result = validateAnswers(
        category([question({ required: true, text: 'Are you ed-tech?' })]),
        [],
      );
      expect(problemOf(result)).toBe('"Are you ed-tech?" must be answered.');
    });

    it('treats an empty value list as unanswered rather than malformed', () => {
      const result = validateAnswers(category([question({ required: true })]), [
        { questionId: 'q1', values: [] },
      ]);
      expect(problemOf(result)).toMatch(/must be answered/);
    });

    it('ignores a required question that has been retired', () => {
      const result = validateAnswers(category([question({ required: true, isActive: false })]), []);
      expect(result.ok).toBe(true);
    });
  });

  describe('choice questions', () => {
    it('rejects a value that is not one of the options', () => {
      const result = validateAnswers(category([question()]), [
        { questionId: 'q1', values: ['Maybe'] },
      ]);
      expect(problemOf(result)).toBe('"Maybe" is not one of the choices for this question.');
    });

    it('rejects two selections on a single-choice question', () => {
      const result = validateAnswers(category([question({ type: 'select' })]), [
        { questionId: 'q1', values: ['Yes', 'No'] },
      ]);
      expect(problemOf(result)).toMatch(/only one choice/i);
    });

    it('accepts several selections on a checkbox question', () => {
      const result = validateAnswers(
        category([question({ type: 'checkbox', options: ['A', 'B', 'C'] })]),
        [{ questionId: 'q1', values: ['A', 'C'] }],
      );
      expect(result.ok).toBe(true);
    });

    it('rejects the same choice twice', () => {
      const result = validateAnswers(
        category([question({ type: 'checkbox', options: ['A', 'B'] })]),
        [{ questionId: 'q1', values: ['A', 'A'] }],
      );
      expect(problemOf(result)).toMatch(/selected twice/i);
    });
  });

  describe('text questions', () => {
    it('accepts one value', () => {
      const result = validateAnswers(category([question({ type: 'text', options: [] })]), [
        { questionId: 'q1', values: ['A sentence'] },
      ]);
      expect(result.ok).toBe(true);
    });

    it('rejects more than one value', () => {
      const result = validateAnswers(category([question({ type: 'text', options: [] })]), [
        { questionId: 'q1', values: ['One', 'Two'] },
      ]);
      expect(problemOf(result)).toMatch(/single answer/i);
    });
  });

  describe('unknown and duplicate questions', () => {
    it('rejects an answer to a question from a different category', () => {
      const result = validateAnswers(category([question()]), [
        { questionId: 'from-elsewhere', values: ['Yes'] },
      ]);
      expect(problemOf(result)).toMatch(/does not belong to the chosen category/i);
    });

    it('drops an answer to a retired question instead of rejecting the submission', () => {
      // The applicant had the form open when an admin retired the question. Refusing would leave
      // them with a form they can never submit, for a decision they had no part in.
      const result = validateAnswers(
        category([question({ id: 'retired', isActive: false }), question({ id: 'live' })]),
        [
          { questionId: 'retired', values: ['Yes'] },
          { questionId: 'live', values: ['No'] },
        ],
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.answers).toEqual([{ questionId: 'live', values: ['No'] }]);
    });

    it('rejects the same question answered twice', () => {
      const result = validateAnswers(category([question()]), [
        { questionId: 'q1', values: ['Yes'] },
        { questionId: 'q1', values: ['No'] },
      ]);
      expect(problemOf(result)).toMatch(/answered twice/i);
    });
  });

  it('returns only the answers worth storing', () => {
    const result = validateAnswers(
      category([question({ id: 'a' }), question({ id: 'b' }), question({ id: 'c' })]),
      [
        { questionId: 'a', values: ['Yes'] },
        { questionId: 'b', values: [] },
      ],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers).toEqual([{ questionId: 'a', values: ['Yes'] }]);
  });
});
