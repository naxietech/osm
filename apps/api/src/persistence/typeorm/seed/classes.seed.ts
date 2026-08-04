import type { DataSource, EntityManager } from 'typeorm';

import { ClassEntity, ClassGroupEntity } from '../entities';

interface SeedGroup {
  name: string;
  subgroups: string[];
}

interface SeedClass {
  name: string;
  ordinal: number;
  description: string;
  groups: SeedGroup[];
}

/**
 * Class 9–12 with the groups the frontend mock has carried all along, so a fresh database
 * matches the screens people already know. Class 1–8 are not seeded: nothing in the product
 * examines them yet, and a class with no groups is simply a class with no `class_groups` rows.
 */
const STANDARD_CLASSES: SeedClass[] = [
  {
    name: 'Class 9',
    ordinal: 9,
    description: 'Secondary — SSC Part I',
    groups: [
      { name: 'Science', subgroups: ['Biology', 'Computer Science'] },
      { name: 'General', subgroups: [] },
    ],
  },
  {
    name: 'Class 10',
    ordinal: 10,
    description: 'Secondary — SSC Part II',
    groups: [
      { name: 'Science', subgroups: ['Biology', 'Computer Science'] },
      { name: 'General', subgroups: [] },
    ],
  },
  {
    name: 'Class 11',
    ordinal: 11,
    description: 'Higher Secondary — HSSC Part I',
    groups: [
      { name: 'Pre-Medical', subgroups: [] },
      { name: 'ICS (Computer Science)', subgroups: [] },
    ],
  },
  {
    name: 'Class 12',
    ordinal: 12,
    description: 'Higher Secondary — HSSC Part II',
    groups: [{ name: 'Pre-Medical', subgroups: [] }],
  },
];

export interface ClassSeedSummary {
  classesCreated: number;
  classesSkipped: number;
  groupsCreated: number;
}

/**
 * Plant the standard classes on a fresh database.
 *
 * Deliberately **insert-only**, like the institute-category seed: these are the user's own
 * data, so re-running `db:seed` never edits or removes an existing row and an admin's work is
 * never undone. A class matched by name is skipped whole — its tree is not reconciled either,
 * so a group the admin renamed or withdrew stays as they left it.
 *
 * The idempotency key is **`name`**, which is itself admin-editable. Renaming "Class 9" frees
 * that name, so a later seed adds a fresh standard "Class 9" alongside the renamed one.
 * Nothing is lost, but the count grows — the same trade the category seed makes, and covered
 * by a test so it stays a decision rather than a surprise.
 *
 * `ON CONFLICT DO NOTHING ... RETURNING id` makes the create-or-skip decision atomic, so two
 * seeds racing on an empty database cannot both insert, nor duplicate the groups.
 */
export async function seedClasses(dataSource: DataSource): Promise<ClassSeedSummary> {
  return dataSource.transaction(async (manager) => {
    const summary: ClassSeedSummary = { classesCreated: 0, classesSkipped: 0, groupsCreated: 0 };

    for (const seedClass of STANDARD_CLASSES) {
      const classId = await insertIfAbsent(manager, seedClass);
      if (!classId) {
        summary.classesSkipped += 1;
        continue;
      }

      summary.classesCreated += 1;
      summary.groupsCreated += await insertTree(manager, classId, seedClass.groups);
    }

    return summary;
  });
}

/** Returns the new id, or `null` when a class with that name already existed. */
async function insertIfAbsent(
  manager: EntityManager,
  seedClass: SeedClass,
): Promise<string | null> {
  const result = await manager
    .createQueryBuilder()
    .insert()
    .into(ClassEntity)
    .values({
      name: seedClass.name,
      ordinal: seedClass.ordinal,
      description: seedClass.description,
    })
    .orIgnore()
    .returning('id')
    .execute();

  return (result.raw as Array<{ id: string }>)[0]?.id ?? null;
}

/** Returns how many rows were written — groups and subgroups together. */
async function insertTree(
  manager: EntityManager,
  classId: string,
  groups: SeedGroup[],
): Promise<number> {
  if (groups.length === 0) return 0;

  const repo = manager.getRepository(ClassGroupEntity);
  const savedGroups = await repo.save(
    groups.map((group, index) =>
      repo.create({ classId, parentId: null, name: group.name, sortOrder: index + 1 }),
    ),
  );

  const subgroups = groups.flatMap((group, index) => {
    const parent = savedGroups[index];
    if (!parent) throw new Error(`seed group "${group.name}" was not returned after insert`);
    return group.subgroups.map((name, childIndex) =>
      repo.create({ classId, parentId: parent.id, name, sortOrder: childIndex + 1 }),
    );
  });

  if (subgroups.length > 0) await repo.save(subgroups);
  return savedGroups.length + subgroups.length;
}
