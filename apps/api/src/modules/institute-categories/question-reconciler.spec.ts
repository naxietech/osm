import type { CategoryQuestionInput } from '@oses/types';

import {
  AnsweredQuestionChangeError,
  type CategoryQuestionRecord,
  DuplicateQuestionIdError,
  UnknownQuestionError,
} from './ports';
import { reconcileQuestions } from './question-reconciler';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';
const FOREIGN_ID = '99999999-9999-4999-8999-999999999999';

function stored(overrides: Partial<CategoryQuestionRecord> = {}): CategoryQuestionRecord {
  return {
    id: ID_A,
    text: 'Are you an ed-tech institute?',
    type: 'radio',
    required: true,
    options: ['Yes', 'No'],
    sortOrder: 1,
    isActive: true,
    ...overrides,
  };
}

function submitted(overrides: Partial<CategoryQuestionInput> = {}): CategoryQuestionInput {
  return {
    text: 'Are you an ed-tech institute?',
    type: 'radio',
    required: true,
    options: ['Yes', 'No'],
    ...overrides,
  };
}

const none: ReadonlySet<string> = new Set();

describe('reconcileQuestions', () => {
  describe('creating questions', () => {
    it('returns an empty plan for an empty category and an empty submission', () => {
      expect(reconcileQuestions([], [], none)).toEqual({
        insert: [],
        update: [],
        deactivate: [],
        remove: [],
      });
    });

    it('inserts every submitted question that carries no id', () => {
      const plan = reconcileQuestions(
        [],
        [submitted({ text: 'First' }), submitted({ text: 'Second' })],
        none,
      );

      expect(plan.insert).toHaveLength(2);
      expect(plan.insert.map((q) => q.text)).toEqual(['First', 'Second']);
      expect(plan.update).toEqual([]);
    });

    it('numbers sortOrder from 1 following the submitted order', () => {
      const plan = reconcileQuestions(
        [],
        [submitted({ text: 'a' }), submitted({ text: 'b' }), submitted({ text: 'c' })],
        none,
      );

      expect(plan.insert.map((q) => q.sortOrder)).toEqual([1, 2, 3]);
    });

    it('defaults required to false and options to an empty list when omitted', () => {
      const plan = reconcileQuestions([], [{ text: 'Describe yourself', type: 'text' }], none);

      expect(plan.insert[0]).toMatchObject({ required: false, options: [] });
    });
  });

  describe('identity — the guarantee the design exists for', () => {
    it('keeps an existing id when the question is submitted back with it', () => {
      const plan = reconcileQuestions([stored()], [submitted({ id: ID_A })], none);

      expect(plan.update).toHaveLength(1);
      expect(plan.update[0]?.id).toBe(ID_A);
      expect(plan.insert).toEqual([]);
    });

    it('only moves sortOrder when a new question is inserted at the top', () => {
      const existing = [
        stored({ id: ID_A, text: 'Original first', sortOrder: 1 }),
        stored({ id: ID_B, text: 'Original second', sortOrder: 2 }),
      ];

      const plan = reconcileQuestions(
        existing,
        [
          submitted({ text: 'Brand new, jumped the queue' }),
          submitted({ id: ID_A, text: 'Original first' }),
          submitted({ id: ID_B, text: 'Original second' }),
        ],
        none,
      );

      expect(plan.insert).toHaveLength(1);
      expect(plan.insert[0]?.sortOrder).toBe(1);
      // Both pre-existing questions keep their ids; only their position changes.
      expect(plan.update.map((q) => [q.id, q.sortOrder])).toEqual([
        [ID_A, 2],
        [ID_B, 3],
      ]);
      expect(plan.remove).toEqual([]);
      expect(plan.deactivate).toEqual([]);
    });

    it('keeps ids stable when the list is reordered', () => {
      const existing = [
        stored({ id: ID_A, sortOrder: 1 }),
        stored({ id: ID_B, sortOrder: 2 }),
        stored({ id: ID_C, sortOrder: 3 }),
      ];

      const plan = reconcileQuestions(
        existing,
        [submitted({ id: ID_C }), submitted({ id: ID_A }), submitted({ id: ID_B })],
        none,
      );

      expect(plan.update.map((q) => [q.id, q.sortOrder])).toEqual([
        [ID_C, 1],
        [ID_A, 2],
        [ID_B, 3],
      ]);
      expect(plan.insert).toEqual([]);
      expect(plan.remove).toEqual([]);
    });
  });

  describe('removing questions', () => {
    it('deletes an omitted question that has no answers', () => {
      const plan = reconcileQuestions([stored({ id: ID_A })], [], none);

      expect(plan.remove).toEqual([ID_A]);
      expect(plan.deactivate).toEqual([]);
    });

    it('retires — never deletes — an omitted question that already has answers', () => {
      const plan = reconcileQuestions([stored({ id: ID_A })], [], new Set([ID_A]));

      expect(plan.deactivate).toEqual([ID_A]);
      expect(plan.remove).toEqual([]);
    });

    it('leaves an already-retired question untouched when it stays omitted', () => {
      const plan = reconcileQuestions([stored({ id: ID_A, isActive: false })], [], new Set([ID_A]));

      expect(plan.deactivate).toEqual([]);
      expect(plan.remove).toEqual([]);
      expect(plan.update).toEqual([]);
    });

    it('puts a retired question back on the form when it is submitted again', () => {
      const plan = reconcileQuestions(
        [stored({ id: ID_A, isActive: false })],
        [submitted({ id: ID_A })],
        new Set([ID_A]),
      );

      expect(plan.update[0]).toMatchObject({ id: ID_A, isActive: true });
      expect(plan.deactivate).toEqual([]);
    });
  });

  describe('protecting questions that already have answers', () => {
    /**
     * The message goes on screen unchanged. An editor looking at a list of questions they wrote
     * cannot turn a uuid back into one of them, so naming the question is the difference between
     * a message they can act on and one they can only forward to a developer.
     */
    it('names the question in words, not by id', () => {
      expect(() =>
        reconcileQuestions(
          [stored({ id: ID_A, options: ['Yes', 'No', 'Other'] })],
          [submitted({ id: ID_A, options: ['Yes', 'No'] })],
          new Set([ID_A]),
        ),
      ).toThrow(
        'The question "Are you an ed-tech institute?" already has answers, so these options cannot be removed: Other.',
      );
    });

    it('keeps the id on the error for logs and callers', () => {
      try {
        reconcileQuestions(
          [stored({ id: ID_A, type: 'radio' })],
          [submitted({ id: ID_A, type: 'checkbox' })],
          new Set([ID_A]),
        );
        throw new Error('expected reconcileQuestions to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(AnsweredQuestionChangeError);
        expect((err as AnsweredQuestionChangeError).questionId).toBe(ID_A);
        expect((err as Error).message).not.toContain(ID_A);
      }
    });

    it('rejects a type change', () => {
      expect(() =>
        reconcileQuestions(
          [stored({ id: ID_A, type: 'radio' })],
          [submitted({ id: ID_A, type: 'checkbox' })],
          new Set([ID_A]),
        ),
      ).toThrow(AnsweredQuestionChangeError);
    });

    it('allows a type change while the question has no answers', () => {
      const plan = reconcileQuestions(
        [stored({ id: ID_A, type: 'radio' })],
        [submitted({ id: ID_A, type: 'checkbox' })],
        none,
      );

      expect(plan.update[0]?.type).toBe('checkbox');
    });

    it('rejects withdrawing an option', () => {
      expect(() =>
        reconcileQuestions(
          [stored({ id: ID_A, options: ['Yes', 'No', 'Not sure'] })],
          [submitted({ id: ID_A, options: ['Yes', 'No'] })],
          new Set([ID_A]),
        ),
      ).toThrow(/Not sure/);
    });

    it('allows adding an option', () => {
      const plan = reconcileQuestions(
        [stored({ id: ID_A, options: ['Yes', 'No'] })],
        [submitted({ id: ID_A, options: ['Yes', 'No', 'Not sure'] })],
        new Set([ID_A]),
      );

      expect(plan.update[0]?.options).toEqual(['Yes', 'No', 'Not sure']);
    });

    it('allows fixing the wording', () => {
      const plan = reconcileQuestions(
        [stored({ id: ID_A, text: 'Are you a ed-tech institute?' })],
        [submitted({ id: ID_A, text: 'Are you an ed-tech institute?' })],
        new Set([ID_A]),
      );

      expect(plan.update[0]?.text).toBe('Are you an ed-tech institute?');
    });

    it('allows toggling required', () => {
      const plan = reconcileQuestions(
        [stored({ id: ID_A, required: true })],
        [submitted({ id: ID_A, required: false })],
        new Set([ID_A]),
      );

      expect(plan.update[0]?.required).toBe(false);
    });

    it('allows reordering', () => {
      const existing = [stored({ id: ID_A, sortOrder: 1 }), stored({ id: ID_B, sortOrder: 2 })];

      const plan = reconcileQuestions(
        existing,
        [submitted({ id: ID_B }), submitted({ id: ID_A })],
        new Set([ID_A, ID_B]),
      );

      expect(plan.update.map((q) => [q.id, q.sortOrder])).toEqual([
        [ID_B, 1],
        [ID_A, 2],
      ]);
    });
  });

  describe('rejecting malformed submissions', () => {
    it('rejects a question id belonging to another category', () => {
      expect(() =>
        reconcileQuestions([stored({ id: ID_A })], [submitted({ id: FOREIGN_ID })], none),
      ).toThrow(UnknownQuestionError);
    });

    it('rejects a question id submitted twice', () => {
      expect(() =>
        reconcileQuestions(
          [stored({ id: ID_A })],
          [submitted({ id: ID_A }), submitted({ id: ID_A })],
          none,
        ),
      ).toThrow(DuplicateQuestionIdError);
    });

    it('names the offending question id in the error', () => {
      expect(() =>
        reconcileQuestions([stored({ id: ID_A })], [submitted({ id: FOREIGN_ID })], none),
      ).toThrow(new RegExp(FOREIGN_ID));
    });
  });

  describe('a realistic mixed edit', () => {
    it('updates, reorders, inserts and removes in one pass', () => {
      const existing = [
        stored({ id: ID_A, text: 'Are you a ed-tech institute?', sortOrder: 1 }),
        stored({ id: ID_B, text: 'Are you NSSOE?', sortOrder: 2 }),
        stored({ id: ID_C, text: 'Do you offer A-levels?', sortOrder: 3 }),
      ];

      const plan = reconcileQuestions(
        existing,
        [
          submitted({ id: ID_A, text: 'Are you an ed-tech institute?' }),
          submitted({ id: ID_C, text: 'Do you offer A-levels?' }),
          submitted({ text: 'Do you have a science lab?' }),
        ],
        new Set([ID_B]),
      );

      expect(plan.update.map((q) => q.id)).toEqual([ID_A, ID_C]);
      expect(plan.update.map((q) => q.sortOrder)).toEqual([1, 2]);
      expect(plan.insert).toHaveLength(1);
      expect(plan.insert[0]).toMatchObject({ text: 'Do you have a science lab?', sortOrder: 3 });
      // B was dropped from the list but is answered, so it is retired rather than deleted.
      expect(plan.deactivate).toEqual([ID_B]);
      expect(plan.remove).toEqual([]);
    });
  });

  describe('purity', () => {
    it('does not mutate its inputs', () => {
      const existing = [stored({ id: ID_A })];
      const incoming = [submitted({ id: ID_A }), submitted({ text: 'New' })];
      const existingSnapshot = structuredClone(existing);
      const incomingSnapshot = structuredClone(incoming);

      reconcileQuestions(existing, incoming, none);

      expect(existing).toEqual(existingSnapshot);
      expect(incoming).toEqual(incomingSnapshot);
    });
  });
});
