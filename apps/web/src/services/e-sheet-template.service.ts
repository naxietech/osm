/**
 * Mock e-sheet template service (frontend only) — the examiner's reusable paper structures.
 *
 * Templates are standalone (no exam / subject binding), so the store lives here rather than
 * in mock-store.ts, which exists for the exam ↔ registration flow. Mutable module-level
 * seed: a template created on the Add screen is visible on the View screen, and everything
 * resets on a page refresh. Mirrors examService — async with simulated latency, exported as
 * a single object.
 *
 * Page counts and crop rectangles are NOT stored. They come from `layoutTemplate()`, so they
 * are always in step with the questions rather than being a copy that can go stale.
 *
 * TODO: replace with a real templatesApi via api-client once the backend lands.
 */
import type {
  CreateESheetTemplateDto,
  ESheetTemplate,
  ESheetTemplateAnswer,
  ESheetTemplateListItem,
  ESheetTemplateQuestion,
  ESheetTemplateQuestionInput,
  UpdateESheetTemplateDto,
} from '@oses/types';

import { layoutTemplate } from '@/lib/e-sheet-layout';

const LATENCY = 400;
function delay<T>(value: T): Promise<T> {
  return new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY));
}

let answerCounter = 0;
function nextAnswerId(): string {
  answerCounter += 1;
  return `ans_${answerCounter}`;
}

let questionCounter = 0;
function nextQuestionId(): string {
  questionCounter += 1;
  return `tplq_${questionCounter}`;
}

let templateCounter = 0;
function nextTemplateId(): string {
  templateCounter += 1;
  return `tpl_new_${templateCounter}`;
}

const SEEDED_AT = '2026-07-01T09:00:00.000Z';

/** Seed helper — `count` answers worth the same marks, all inheriting the question's space. */
function seedAnswers(prefix: string, count: number, maxMarks: number): ESheetTemplateAnswer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}_${index + 1}`,
    maxMarks,
  }));
}

/** Mutable store. Seeded with two shapes so the list screen is not empty on first load. */
export const eSheetTemplates: ESheetTemplate[] = [
  {
    id: 'tpl_science_65',
    name: 'Science Paper — 65 Marks',
    instructions:
      'Write your answers inside the corner marks only. Fill the bubbles completely.\nUse a black or blue pen.',
    isActive: true,
    createdAt: SEEDED_AT,
    questions: [
      {
        id: 'tplq_s1',
        questionNo: 1,
        type: 'mcq',
        optionCount: 4,
        answers: seedAnswers('sci_q1', 12, 1),
      },
      {
        id: 'tplq_s2',
        questionNo: 2,
        type: 'short-answer',
        defaultSpace: 'quarter',
        answers: seedAnswers('sci_q2', 5, 3),
      },
      {
        id: 'tplq_s3',
        questionNo: 3,
        type: 'short-answer',
        defaultSpace: 'quarter',
        answers: seedAnswers('sci_q3', 6, 3),
      },
      {
        id: 'tplq_s4',
        questionNo: 4,
        type: 'long-answer',
        defaultSpace: 'half',
        answers: [
          // the first part needs a whole side; the second takes the question's half
          { id: 'sci_q4_1', maxMarks: 12, space: 'full' },
          { id: 'sci_q4_2', maxMarks: 8 },
        ],
      },
    ],
  },
  {
    id: 'tpl_math_75',
    name: 'Mathematics Paper — 75 Marks',
    instructions:
      'Show your working inside the corner marks. Anything written outside them is not marked.',
    isActive: true,
    createdAt: SEEDED_AT,
    questions: [
      {
        id: 'tplq_m1',
        questionNo: 1,
        type: 'mcq',
        optionCount: 4,
        answers: seedAnswers('math_q1', 15, 1),
      },
      // Roman numbering on the written questions, to show it varying per question.
      {
        id: 'tplq_m2',
        questionNo: 2,
        type: 'short-answer',
        subPartLabelStyle: 'roman',
        defaultSpace: 'quarter',
        answers: seedAnswers('math_q2', 8, 3),
      },
      {
        id: 'tplq_m3',
        questionNo: 3,
        type: 'long-answer',
        subPartLabelStyle: 'roman',
        defaultSpace: 'full',
        answers: seedAnswers('math_q3', 3, 12),
      },
    ],
  },
];

/** Give the input questions and their answers ids, in the order the examiner arranged them. */
function materializeQuestions(questions: ESheetTemplateQuestionInput[]): ESheetTemplateQuestion[] {
  return questions.map((question) => ({
    id: nextQuestionId(),
    questionNo: question.questionNo,
    type: question.type,
    ...(question.optionCount === undefined ? {} : { optionCount: question.optionCount }),
    ...(question.subPartLabelStyle === undefined
      ? {}
      : { subPartLabelStyle: question.subPartLabelStyle }),
    ...(question.defaultSpace === undefined ? {} : { defaultSpace: question.defaultSpace }),
    answers: question.answers.map((answer) => ({
      id: nextAnswerId(),
      maxMarks: answer.maxMarks,
      ...(answer.space === undefined ? {} : { space: answer.space }),
    })),
  }));
}

/**
 * Project a template onto its table row. Answer count, marks and page count all come from
 * the layout engine, so the row can never disagree with what the preview shows.
 */
export function toESheetTemplateListItem(template: ESheetTemplate): ESheetTemplateListItem {
  const layout = layoutTemplate(template);
  return {
    id: template.id,
    name: template.name,
    questionCount: template.questions.length,
    answerCount: layout.answerCount,
    totalMarks: layout.totalMarks,
    pageCount: layout.pages.length,
    isActive: template.isActive,
    createdAt: template.createdAt,
  };
}

function findTemplate(id: string): ESheetTemplate | undefined {
  return eSheetTemplates.find((t) => t.id === id);
}

/**
 * Is this name already used? Case-insensitive and trimmed, because "Science Paper" and
 * "science paper " are the same thing to the examiner picking one from a dropdown.
 * Pass `excludeId` while editing so a template does not clash with itself.
 */
export function isTemplateNameTaken(name: string, excludeId?: string): boolean {
  const needle = name.trim().toLowerCase();
  if (needle === '') return false;
  return eSheetTemplates.some((t) => t.id !== excludeId && t.name.trim().toLowerCase() === needle);
}

function listTemplates(): Promise<ESheetTemplateListItem[]> {
  return delay(eSheetTemplates.map(toESheetTemplateListItem));
}

function getTemplate(id: string): Promise<ESheetTemplate | undefined> {
  return delay(findTemplate(id));
}

function createTemplate(dto: CreateESheetTemplateDto): Promise<ESheetTemplate> {
  const name = dto.name.trim();
  if (isTemplateNameTaken(name)) {
    return Promise.reject(new Error('A template with this name already exists'));
  }
  const instructions = dto.instructions?.trim() ?? '';
  const template: ESheetTemplate = {
    id: nextTemplateId(),
    name,
    ...(instructions === '' ? {} : { instructions }),
    questions: materializeQuestions(dto.questions),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  eSheetTemplates.push(template);
  return delay(template);
}

function updateTemplate(id: string, dto: UpdateESheetTemplateDto): Promise<ESheetTemplate> {
  const template = findTemplate(id);
  if (!template) return Promise.reject(new Error('Template not found'));

  if (dto.name !== undefined) {
    const name = dto.name.trim();
    if (isTemplateNameTaken(name, id)) {
      return Promise.reject(new Error('A template with this name already exists'));
    }
    template.name = name;
  }
  if (dto.instructions !== undefined) {
    const instructions = dto.instructions.trim();
    if (instructions === '') delete template.instructions;
    else template.instructions = instructions;
  }
  if (dto.questions !== undefined) template.questions = materializeQuestions(dto.questions);
  if (dto.isActive !== undefined) template.isActive = dto.isActive;

  return delay(template);
}

function deleteTemplate(id: string): Promise<void> {
  const template = findTemplate(id);
  if (!template) return Promise.reject(new Error('Template not found'));
  eSheetTemplates.splice(eSheetTemplates.indexOf(template), 1);
  return delay(undefined);
}

function toggleTemplateActive(id: string): Promise<ESheetTemplate> {
  const template = findTemplate(id);
  if (!template) return Promise.reject(new Error('Template not found'));
  template.isActive = !template.isActive;
  return delay(template);
}

export const eSheetTemplateService = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateActive,
  isTemplateNameTaken,
};
