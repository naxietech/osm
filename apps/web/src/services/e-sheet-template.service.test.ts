import { describe, expect, it } from 'vitest';

import type { ESheetTemplateQuestionInput } from '@oses/types';

import { eSheetTemplateService, toESheetTemplateListItem } from './e-sheet-template.service';

/** One MCQ question (2 bubbles rows) and one short-answer question (2 parts, 6 lines each). */
function questions(): ESheetTemplateQuestionInput[] {
  return [
    {
      questionNo: 1,
      type: 'mcq',
      optionCount: 4,
      answers: [{ maxMarks: 1 }, { maxMarks: 1 }],
    },
    {
      questionNo: 2,
      type: 'short-answer',
      answers: [
        { maxMarks: 3, space: 'quarter' },
        { maxMarks: 4, space: 'quarter' },
      ],
    },
  ];
}

describe('eSheetTemplateService', () => {
  it('creates a template, active by default, with ids down to every answer', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: 'Create Test',
      questions: questions(),
    });

    expect(created.isActive).toBe(true);
    expect(created.questions).toHaveLength(2);
    expect(created.questions.every((q) => q.id.length > 0)).toBe(true);
    expect(created.questions.flatMap((q) => q.answers).every((a) => a.id.length > 0)).toBe(true);
    expect(await eSheetTemplateService.getTemplate(created.id)).toBeDefined();
  });

  it('keeps a space override on written answers and leaves MCQ answers without one', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: 'Lines Test',
      questions: questions(),
    });

    expect(created.questions[0]?.answers[0]?.space).toBeUndefined(); // MCQ
    expect(created.questions[1]?.answers[0]?.space).toBe('quarter');
  });

  it('trims the name and rejects a duplicate regardless of case or padding', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: '  Duplicate Test  ',
      questions: questions(),
    });
    expect(created.name).toBe('Duplicate Test');

    await expect(
      eSheetTemplateService.createTemplate({ name: 'duplicate test', questions: questions() }),
    ).rejects.toThrow(/already exists/i);
  });

  it('reports a name as taken but never clashes a template with itself', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: 'Self Clash Test',
      questions: questions(),
    });

    expect(eSheetTemplateService.isTemplateNameTaken('Self Clash Test')).toBe(true);
    expect(eSheetTemplateService.isTemplateNameTaken('Self Clash Test', created.id)).toBe(false);
    expect(eSheetTemplateService.isTemplateNameTaken('   ')).toBe(false);

    const renamed = await eSheetTemplateService.updateTemplate(created.id, {
      name: 'Self Clash Test',
    });
    expect(renamed.name).toBe('Self Clash Test');
  });

  it('stores trimmed instructions and drops them when emptied', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: 'Instructions Test',
      instructions: '  Write inside the boxes.  ',
      questions: questions(),
    });
    expect(created.instructions).toBe('Write inside the boxes.');

    const cleared = await eSheetTemplateService.updateTemplate(created.id, { instructions: '   ' });
    expect(cleared.instructions).toBeUndefined();
  });

  it('omits instructions entirely when created blank', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: 'No Instructions Test',
      instructions: '   ',
      questions: questions(),
    });
    expect(created.instructions).toBeUndefined();
  });

  it('replaces the whole question list on update', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: 'Update Test',
      questions: questions(),
    });

    const updated = await eSheetTemplateService.updateTemplate(created.id, {
      questions: [
        { questionNo: 1, type: 'long-answer', answers: [{ maxMarks: 20, space: 'quarter' }] },
      ],
    });

    expect(updated.questions).toHaveLength(1);
    expect(updated.questions[0]?.type).toBe('long-answer');
    expect(updated.questions[0]?.answers).toHaveLength(1);
  });

  it('flips isActive on toggle and leaves the template in place', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: 'Toggle Test',
      questions: questions(),
    });

    expect((await eSheetTemplateService.toggleTemplateActive(created.id)).isActive).toBe(false);
    expect((await eSheetTemplateService.toggleTemplateActive(created.id)).isActive).toBe(true);
    expect(await eSheetTemplateService.getTemplate(created.id)).toBeDefined();
  });

  it('removes a deleted template from the list', async () => {
    const created = await eSheetTemplateService.createTemplate({
      name: 'Delete Test',
      questions: questions(),
    });

    await eSheetTemplateService.deleteTemplate(created.id);

    expect(await eSheetTemplateService.getTemplate(created.id)).toBeUndefined();
    const rows = await eSheetTemplateService.listTemplates();
    expect(rows.map((r) => r.id)).not.toContain(created.id);
  });

  it('rejects update / delete / toggle for an unknown id', async () => {
    await expect(eSheetTemplateService.updateTemplate('nope', { name: 'x' })).rejects.toThrow(
      /not found/i,
    );
    await expect(eSheetTemplateService.deleteTemplate('nope')).rejects.toThrow(/not found/i);
    await expect(eSheetTemplateService.toggleTemplateActive('nope')).rejects.toThrow(/not found/i);
  });

  it('rejects a rename that collides with another template', async () => {
    await eSheetTemplateService.createTemplate({ name: 'Rename A', questions: questions() });
    const b = await eSheetTemplateService.createTemplate({
      name: 'Rename B',
      questions: questions(),
    });

    await expect(eSheetTemplateService.updateTemplate(b.id, { name: 'rename a' })).rejects.toThrow(
      /already exists/i,
    );
  });

  it('derives the row from the layout — answers, marks and real page count', () => {
    const row = toESheetTemplateListItem({
      id: 'tpl_x',
      name: 'Row Test',
      isActive: true,
      createdAt: '2026-07-01T00:00:00.000Z',
      questions: [
        {
          id: 'q1',
          questionNo: 1,
          type: 'short-answer',
          answers: [
            { id: 'a1', maxMarks: 9, space: 'quarter' },
            { id: 'a2', maxMarks: 6, space: 'quarter' },
          ],
        },
      ],
    });

    expect(row.questionCount).toBe(1);
    expect(row.answerCount).toBe(2);
    expect(row.totalMarks).toBe(15);
    expect(row.pageCount).toBe(2); // the cover, then the question
  });

  it('reports the extra pages a long answer forces', () => {
    // two sides cannot fit one, so the answer splits across two pages after the cover.
    const row = toESheetTemplateListItem({
      id: 'tpl_long',
      name: 'Long Row Test',
      isActive: true,
      createdAt: '2026-07-01T00:00:00.000Z',
      questions: [
        {
          id: 'q1',
          questionNo: 1,
          type: 'long-answer',
          answers: [{ id: 'a1', maxMarks: 20, space: 'two-sides' }],
        },
      ],
    });

    expect(row.pageCount).toBe(3);
    expect(row.answerCount).toBe(1);
  });

  it('reports zero totals and a single page for a template with no questions', () => {
    const row = toESheetTemplateListItem({
      id: 'tpl_empty',
      name: 'Empty',
      isActive: false,
      createdAt: '2026-07-01T00:00:00.000Z',
      questions: [],
    });

    expect(row.questionCount).toBe(0);
    expect(row.answerCount).toBe(0);
    expect(row.totalMarks).toBe(0);
    expect(row.pageCount).toBe(1); // the information cover still exists
  });

  it('lists the seeded templates with their real page counts', async () => {
    const rows = await eSheetTemplateService.listTemplates();

    const science = rows.find((r) => r.id === 'tpl_science_65');
    expect(science?.totalMarks).toBe(65);
    expect(science?.answerCount).toBe(25); // 12 MCQ + 5 + 6 + 2
    expect(science?.pageCount).toBeGreaterThan(1);

    const maths = rows.find((r) => r.id === 'tpl_math_75');
    expect(maths?.totalMarks).toBe(75);
    expect(maths?.answerCount).toBe(26); // 15 MCQ + 8 + 3
  });
});
