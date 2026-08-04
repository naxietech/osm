import { reconcileTree, toInitialGroups } from './class-tree-reconciler';
import {
  type ClassGroupRecord,
  DuplicateClassGroupIdError,
  MisplacedClassGroupError,
  UnknownClassGroupError,
} from './ports';

const SCIENCE = '11111111-1111-4111-8111-111111111111';
const BIOLOGY = '22222222-2222-4222-8222-222222222222';
const ARTS = '33333333-3333-4333-8333-333333333333';
const PHYSICS = '44444444-4444-4444-8444-444444444444';
const STRANGER = '99999999-9999-4999-8999-999999999999';

function group(id: string, name: string, isActive = true, sortOrder = 1): ClassGroupRecord {
  return { id, parentId: null, name, sortOrder, isActive };
}
function subgroup(
  id: string,
  parentId: string,
  name: string,
  isActive = true,
  sortOrder = 1,
): ClassGroupRecord {
  return { id, parentId, name, sortOrder, isActive };
}

/** Class 9 → Science → Biology, plus a standalone Arts group second in order. */
function tree(): ClassGroupRecord[] {
  return [
    group(SCIENCE, 'Science'),
    subgroup(BIOLOGY, SCIENCE, 'Biology'),
    group(ARTS, 'Arts', true, 2),
  ];
}

describe('reconcileTree', () => {
  describe('the four cases of a tree save', () => {
    it('leaves an unchanged node completely alone', () => {
      const plan = reconcileTree(tree(), [
        { id: SCIENCE, name: 'Science', subgroups: [{ id: BIOLOGY, name: 'Biology' }] },
        { id: ARTS, name: 'Arts', subgroups: [] },
      ]);

      expect(plan).toEqual({
        insertGroups: [],
        insertSubgroups: [],
        keep: [],
        deactivate: [],
      });
    });

    it('renames a node that kept its id', () => {
      const plan = reconcileTree(tree(), [
        { id: SCIENCE, name: 'Sciences', subgroups: [{ id: BIOLOGY, name: 'Biology' }] },
        { id: ARTS, name: 'Arts', subgroups: [] },
      ]);

      expect(plan.keep).toEqual([{ id: SCIENCE, name: 'Sciences', sortOrder: 1 }]);
      expect(plan.deactivate).toEqual([]);
    });

    it('inserts a group with no id, together with its subgroups', () => {
      const plan = reconcileTree(tree(), [
        { id: SCIENCE, name: 'Science', subgroups: [{ id: BIOLOGY, name: 'Biology' }] },
        { id: ARTS, name: 'Arts', subgroups: [] },
        { name: 'Commerce', subgroups: [{ name: 'Accounting' }] },
      ]);

      expect(plan.insertGroups).toEqual([
        { name: 'Commerce', sortOrder: 3, subgroups: ['Accounting'] },
      ]);
      expect(plan.insertSubgroups).toEqual([]);
      expect(plan.deactivate).toEqual([]);
    });

    it('inserts a subgroup under a group that already exists', () => {
      const plan = reconcileTree(tree(), [
        {
          id: SCIENCE,
          name: 'Science',
          subgroups: [{ id: BIOLOGY, name: 'Biology' }, { name: 'Physics' }],
        },
        { id: ARTS, name: 'Arts', subgroups: [] },
      ]);

      expect(plan.insertSubgroups).toEqual([{ parentId: SCIENCE, name: 'Physics', sortOrder: 2 }]);
      expect(plan.insertGroups).toEqual([]);
    });

    it('deactivates a group the payload does not mention, rather than deleting it', () => {
      const plan = reconcileTree(tree(), [
        { id: SCIENCE, name: 'Science', subgroups: [{ id: BIOLOGY, name: 'Biology' }] },
      ]);

      expect(plan.deactivate).toEqual([ARTS]);
    });

    it('deactivates a subgroup the payload does not mention', () => {
      const plan = reconcileTree(tree(), [
        { id: SCIENCE, name: 'Science', subgroups: [] },
        { id: ARTS, name: 'Arts', subgroups: [] },
      ]);

      expect(plan.deactivate).toEqual([BIOLOGY]);
    });
  });

  describe('deactivating a group takes its subgroups with it', () => {
    it('deactivates the children of a dropped group', () => {
      const plan = reconcileTree(tree(), [{ id: ARTS, name: 'Arts', subgroups: [] }]);

      // Never an active subgroup hanging under a deactivated group.
      expect(plan.deactivate).toEqual([SCIENCE, BIOLOGY]);
    });

    it('does not re-deactivate a row that is already off', () => {
      const existing = [group(SCIENCE, 'Science'), group(ARTS, 'Arts', false)];

      const plan = reconcileTree(existing, [{ id: SCIENCE, name: 'Science', subgroups: [] }]);

      expect(plan.deactivate).toEqual([]);
    });
  });

  describe('reviving a deactivated name', () => {
    it('switches the original group back on instead of inserting a second one', () => {
      const existing = [group(SCIENCE, 'Science'), group(ARTS, 'Arts', false)];

      const plan = reconcileTree(existing, [
        { id: SCIENCE, name: 'Science', subgroups: [] },
        { name: 'Arts', subgroups: [] },
      ]);

      // The id is what students and exams point at — reviving keeps them pointing at it.
      expect(plan.keep).toEqual([{ id: ARTS, name: 'Arts', sortOrder: 2 }]);
      expect(plan.insertGroups).toEqual([]);
    });

    it('matches case-insensitively, because the column is citext', () => {
      const existing = [group(ARTS, 'Arts', false)];

      const plan = reconcileTree(existing, [{ name: 'ARTS', subgroups: [] }]);

      // Stored as typed, but recognised as the same row — an insert here would be refused by
      // the unique index, over a group the admin cannot even see.
      expect(plan.keep).toEqual([{ id: ARTS, name: 'ARTS', sortOrder: 1 }]);
      expect(plan.insertGroups).toEqual([]);
    });

    it('revives a deactivated subgroup under its original group', () => {
      const existing = [group(SCIENCE, 'Science'), subgroup(BIOLOGY, SCIENCE, 'Biology', false)];

      const plan = reconcileTree(existing, [
        { id: SCIENCE, name: 'Science', subgroups: [{ name: 'Biology' }] },
      ]);

      expect(plan.keep).toEqual([{ id: BIOLOGY, name: 'Biology', sortOrder: 1 }]);
      expect(plan.insertSubgroups).toEqual([]);
    });

    it('inserts rather than revives when the matching row is already claimed', () => {
      // 'Science' is claimed by id and renamed to 'Arts'; a second entry then asks for
      // 'Science', which must become a new row rather than stealing the one just renamed.
      const existing = [group(SCIENCE, 'Science')];

      const plan = reconcileTree(existing, [
        { id: SCIENCE, name: 'Arts', subgroups: [] },
        { name: 'Science', subgroups: [] },
      ]);

      expect(plan.keep).toEqual([{ id: SCIENCE, name: 'Arts', sortOrder: 1 }]);
      expect(plan.insertGroups).toEqual([{ name: 'Science', sortOrder: 2, subgroups: [] }]);
    });
  });

  describe('position among siblings', () => {
    it('renumbers by submitted order, so a reordered payload is all a reorder takes', () => {
      const plan = reconcileTree(tree(), [
        { id: ARTS, name: 'Arts', subgroups: [] },
        { id: SCIENCE, name: 'Science', subgroups: [{ id: BIOLOGY, name: 'Biology' }] },
      ]);

      // Names are unchanged; only the positions swap — and the ids are untouched, so nothing
      // pointing at either group is disturbed.
      expect(plan.keep).toEqual([
        { id: ARTS, name: 'Arts', sortOrder: 1 },
        { id: SCIENCE, name: 'Science', sortOrder: 2 },
      ]);
      expect(plan.insertGroups).toEqual([]);
      expect(plan.deactivate).toEqual([]);
    });

    it('numbers subgroups within their own group, not across the class', () => {
      const existing = [group(SCIENCE, 'Science'), group(ARTS, 'Arts', true, 2)];

      const plan = reconcileTree(existing, [
        { id: SCIENCE, name: 'Science', subgroups: [{ name: 'Biology' }] },
        { id: ARTS, name: 'Arts', subgroups: [{ name: 'History' }] },
      ]);

      // Both are the first subgroup of their own group.
      expect(plan.insertSubgroups).toEqual([
        { parentId: SCIENCE, name: 'Biology', sortOrder: 1 },
        { parentId: ARTS, name: 'History', sortOrder: 1 },
      ]);
    });
  });

  describe('rejections', () => {
    it('refuses an id that belongs to another class', () => {
      expect(() =>
        reconcileTree(tree(), [{ id: STRANGER, name: 'Science', subgroups: [] }]),
      ).toThrow(UnknownClassGroupError);
    });

    it('refuses an unknown subgroup id', () => {
      expect(() =>
        reconcileTree(tree(), [
          { id: SCIENCE, name: 'Science', subgroups: [{ id: STRANGER, name: 'Biology' }] },
        ]),
      ).toThrow(UnknownClassGroupError);
    });

    it('refuses the same id twice', () => {
      expect(() =>
        reconcileTree(tree(), [
          { id: SCIENCE, name: 'Science', subgroups: [] },
          { id: SCIENCE, name: 'Sciences', subgroups: [] },
        ]),
      ).toThrow(DuplicateClassGroupIdError);
    });

    it('refuses a subgroup sent as a top-level group', () => {
      expect(() =>
        reconcileTree(tree(), [{ id: BIOLOGY, name: 'Biology', subgroups: [] }]),
      ).toThrow(MisplacedClassGroupError);
    });

    it('refuses a subgroup nested under another subgroup — the rule SQL cannot hold', () => {
      const existing = [...tree(), subgroup(PHYSICS, SCIENCE, 'Physics')];

      // Sending Biology as a group whose subgroup is Physics would make Physics a third level.
      // It is refused at the first step: Biology is not a group.
      expect(() =>
        reconcileTree(existing, [
          { id: BIOLOGY, name: 'Biology', subgroups: [{ id: PHYSICS, name: 'Physics' }] },
        ]),
      ).toThrow(MisplacedClassGroupError);
    });

    it('refuses a group sent as a subgroup', () => {
      expect(() =>
        reconcileTree(tree(), [
          { id: SCIENCE, name: 'Science', subgroups: [{ id: ARTS, name: 'Arts' }] },
        ]),
      ).toThrow(MisplacedClassGroupError);
    });

    it('refuses moving a subgroup to a different group', () => {
      expect(() =>
        reconcileTree(tree(), [
          { id: SCIENCE, name: 'Science', subgroups: [] },
          { id: ARTS, name: 'Arts', subgroups: [{ id: BIOLOGY, name: 'Biology' }] },
        ]),
      ).toThrow(MisplacedClassGroupError);
    });

    it('refuses re-homing an existing subgroup under a group being created', () => {
      expect(() =>
        reconcileTree(tree(), [
          { id: SCIENCE, name: 'Science', subgroups: [] },
          { name: 'Commerce', subgroups: [{ id: BIOLOGY, name: 'Biology' }] },
        ]),
      ).toThrow(MisplacedClassGroupError);
    });
  });

  it('clears the whole tree when sent an empty array', () => {
    const plan = reconcileTree(tree(), []);

    expect(plan.deactivate).toEqual([SCIENCE, BIOLOGY, ARTS]);
    expect(plan.insertGroups).toEqual([]);
  });

  it('treats an omitted subgroups list as no subgroups', () => {
    const plan = reconcileTree([group(SCIENCE, 'Science')], [{ id: SCIENCE, name: 'Science' }]);

    expect(plan).toEqual({ insertGroups: [], insertSubgroups: [], keep: [], deactivate: [] });
  });
});

describe('toInitialGroups', () => {
  it('flattens a submitted tree into inserts', () => {
    expect(
      toInitialGroups([{ name: 'Science', subgroups: [{ name: 'Biology' }] }, { name: 'Arts' }]),
    ).toEqual([
      { name: 'Science', sortOrder: 1, subgroups: ['Biology'] },
      { name: 'Arts', sortOrder: 2, subgroups: [] },
    ]);
  });
});
