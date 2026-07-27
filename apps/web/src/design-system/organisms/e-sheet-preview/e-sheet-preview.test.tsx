import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ESheetTemplate, ESheetTemplateQuestion } from '@oses/types';

import { ESheetPreview } from './e-sheet-preview';

function template(questions: ESheetTemplateQuestion[], instructions?: string): ESheetTemplate {
  return {
    id: 'tpl_preview',
    name: 'Preview Template',
    questions,
    isActive: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...(instructions === undefined ? {} : { instructions }),
  };
}

describe('ESheetPreview', () => {
  it('asks for questions when there is nothing to draw', () => {
    render(<ESheetPreview template={null} />);
    expect(screen.getByText(/Fill in the questions to see the printed sheet/i)).toBeInTheDocument();
  });

  it('summarises the sheet above the pages', () => {
    render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'short-answer',
            answers: [
              { id: 'a1', maxMarks: 3, space: 'quarter' },
              { id: 'a2', maxMarks: 4, space: 'quarter' },
            ],
          },
        ])}
      />,
    );

    // 2 pages: the information cover, then the question
    expect(screen.getByText(/2 pages · 2 answers · 7 marks/i)).toBeInTheDocument();
  });

  it('captions every page and prints the page number on the sheet', () => {
    // 52 lines splits across whole sides, so this template spans three pages.
    render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'long-answer',
            answers: [{ id: 'a1', maxMarks: 20, space: 'two-sides' }],
          },
        ])}
      />,
    );

    expect(screen.getAllByText('Page 1 of 3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Page 2 of 3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Page 3 of 3').length).toBeGreaterThanOrEqual(1);
  });

  it('marks a split answer as continued, with its slice number', () => {
    render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'long-answer',
            answers: [{ id: 'a1', maxMarks: 20, space: 'two-sides' }],
          },
        ])}
      />,
    );

    expect(screen.getByText(/continued 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/continued 2 of 2/i)).toBeInTheDocument();
  });

  it('prints one lettered bubble per option on an MCQ answer', () => {
    render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'mcq',
            optionCount: 5,
            answers: [{ id: 'a1', maxMarks: 1 }],
          },
        ])}
      />,
    );

    for (const letter of ['A', 'B', 'C', 'D', 'E']) {
      expect(screen.getByText(letter)).toBeInTheDocument();
    }
    expect(screen.queryByText('F')).not.toBeInTheDocument();
  });

  it('shows each answer label and what it is worth', () => {
    render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 4,
            type: 'short-answer',
            answers: [
              { id: 'a1', maxMarks: 1, space: 'quarter' },
              { id: 'a2', maxMarks: 6, space: 'quarter' },
            ],
          },
        ])}
      />,
    );

    expect(screen.getByText('Q. No. 4 Part (a)')).toBeInTheDocument();
    expect(screen.getByText('Q. No. 4 Part (b)')).toBeInTheDocument();
    expect(screen.getByText('1 mark')).toBeInTheDocument();
    expect(screen.getByText('6 marks')).toBeInTheDocument();
  });

  it('shows the bubble-filling legend only when the paper has MCQs', () => {
    const mcq = render(
      <ESheetPreview
        template={template([
          { id: 'q1', questionNo: 1, type: 'mcq', answers: [{ id: 'a1', maxMarks: 1 }] },
        ])}
      />,
    );
    expect(mcq.getByText(/Filling a bubble/i)).toBeInTheDocument();
    expect(mcq.getByText('Correct')).toBeInTheDocument();
    expect(mcq.getByText(/Not counted/i)).toBeInTheDocument();
    mcq.unmount();

    const written = render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'short-answer',
            answers: [{ id: 'a1', maxMarks: 3, space: 'quarter' }],
          },
        ])}
      />,
    );
    expect(written.queryByText(/Filling a bubble/i)).not.toBeInTheDocument();
  });

  it('puts an MCQ number and its bubbles on one line, with a timing mark for the scanner', () => {
    const { container } = render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'mcq',
            optionCount: 4,
            answers: [
              { id: 'm1', maxMarks: 1 },
              { id: 'm2', maxMarks: 1 },
              { id: 'm3', maxMarks: 1 },
            ],
          },
        ])}
      />,
    );

    // a bubble row is numbered inside its question — the heading above carries the question no.
    expect(screen.queryByText('Q. No. 1 Part (a)')).not.toBeInTheDocument();

    // the row's number and its four bubbles share one element
    const row = screen.getByText('a.').parentElement;
    expect(row).not.toBeNull();
    for (const letter of ['A', 'B', 'C', 'D']) {
      expect(row?.textContent).toContain(letter);
    }

    // one timing mark per bubble row — what the reader counts to find each row
    expect(container.querySelectorAll('[data-timing-mark]')).toHaveLength(3);
  });

  it('does not clutter a bubble row with "1 mark", but says so when it is worth more', () => {
    /** Text printed on the answer page itself, ignoring the summary above the sheet. */
    const answerPageText = (container: HTMLElement): string =>
      container.querySelectorAll('.esheet-page')[1]?.textContent ?? '';

    const one = render(
      <ESheetPreview
        template={template([
          { id: 'q1', questionNo: 1, type: 'mcq', answers: [{ id: 'm1', maxMarks: 1 }] },
        ])}
      />,
    );
    expect(answerPageText(one.container)).not.toMatch(/mark/i);
    one.unmount();

    const two = render(
      <ESheetPreview
        template={template([
          { id: 'q1', questionNo: 1, type: 'mcq', answers: [{ id: 'm1', maxMarks: 2 }] },
        ])}
      />,
    );
    expect(answerPageText(two.container)).toContain('2 marks');
  });

  it('gives every written line its own row so the first line is usable', () => {
    const { container } = render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'short-answer',
            answers: [{ id: 'a1', maxMarks: 3, space: 'quarter' }],
          },
        ])}
      />,
    );

    // 5 lines -> 5 equal rows, each ruled at its bottom edge (writing space sits above a rule)
    const rules = container.querySelectorAll('[data-ruled-line]');
    expect(rules).toHaveLength(5);
    for (const rule of Array.from(rules)) {
      expect(rule.className).toContain('flex-1');
      expect(rule.className).toContain('border-b');
    }
  });

  it('draws the whole information cover, plus the instructions', () => {
    render(
      <ESheetPreview
        template={template(
          [{ id: 'q1', questionNo: 1, type: 'mcq', answers: [{ id: 'a1', maxMarks: 1 }] }],
          'Write inside the corner marks.',
        )}
      />,
    );

    for (const label of [
      'Roll Number',
      'School / Institute',
      'Class',
      'Subject',
      'Candidate Name',
      'Date',
      'QR',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText('Write inside the corner marks.')).toBeInTheDocument();
  });

  it('keeps every identifying detail off the answer pages', () => {
    const { container } = render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'short-answer',
            answers: [{ id: 'a1', maxMarks: 3, space: 'quarter' }],
          },
        ])}
      />,
    );

    // page 1 is the cover; page 2 onwards must carry no candidate details at all
    const pages = container.querySelectorAll('.esheet-page');
    expect(pages).toHaveLength(2);
    const answerPage = pages[1]?.textContent ?? '';
    for (const label of ['Roll Number', 'Candidate Name', 'School / Institute', 'QR']) {
      expect(answerPage).not.toContain(label);
    }
  });

  it('omits the instructions block when the template has none', () => {
    render(
      <ESheetPreview
        template={template([
          { id: 'q1', questionNo: 1, type: 'mcq', answers: [{ id: 'a1', maxMarks: 1 }] },
        ])}
      />,
    );

    expect(screen.queryByText('Instructions')).not.toBeInTheDocument();
  });

  it('marks written answers with crop brackets and leaves MCQ bubbles unmarked', () => {
    const { container } = render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'mcq',
            answers: [
              { id: 'm1', maxMarks: 1 },
              { id: 'm2', maxMarks: 1 },
              { id: 'm3', maxMarks: 1 },
            ],
          },
          {
            id: 'q2',
            questionNo: 2,
            type: 'short-answer',
            answers: [
              { id: 's1', maxMarks: 3, space: 'quarter' },
              { id: 's2', maxMarks: 3, space: 'quarter' },
            ],
          },
        ])}
      />,
    );

    // Two written answers get brackets; the three bubble rows get nothing at all.
    expect(container.querySelectorAll('[data-crop-marks]')).toHaveLength(2);
  });

  it('numbers each question in its own style', () => {
    render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'short-answer',
            subPartLabelStyle: 'roman',
            answers: [
              { id: 'a1', maxMarks: 3, space: 'quarter' },
              { id: 'a2', maxMarks: 3, space: 'quarter' },
            ],
          },
          {
            id: 'q2',
            questionNo: 2,
            type: 'short-answer',
            answers: [
              { id: 'b1', maxMarks: 3, space: 'quarter' },
              { id: 'b2', maxMarks: 3, space: 'quarter' },
            ],
          },
        ])}
      />,
    );

    expect(screen.getByText('Q. No. 1 Part (i)')).toBeInTheDocument();
    expect(screen.getByText('Q. No. 1 Part (ii)')).toBeInTheDocument();
    expect(screen.queryByText('Q. No. 1 Part (a)')).not.toBeInTheDocument();
    // question 2 said nothing, so it stays on letters
    expect(screen.getByText('Q. No. 2 Part (a)')).toBeInTheDocument();
    expect(screen.getByText('Q. No. 2 Part (b)')).toBeInTheDocument();
  });

  it('draws a roll-number grid: a write-in box per digit over a 0–9 bubble column', () => {
    const { container } = render(
      <ESheetPreview
        template={template([
          { id: 'q1', questionNo: 1, type: 'mcq', answers: [{ id: 'a1', maxMarks: 1 }] },
        ])}
      />,
    );

    const grid = container.querySelector('[data-roll-grid]');
    expect(grid).not.toBeNull();
    expect(grid?.textContent).toContain('Roll Number');
    // 8 digit columns, each carrying the full 0–9 column
    for (const digit of ['0', '5', '9']) {
      expect((grid?.textContent?.match(new RegExp(digit, 'g')) ?? []).length).toBe(8);
    }
  });

  it('heads each question with its number and type', () => {
    // Two answers apiece, so a heading ("Q. No. 1") can't be confused with a written answer's
    // label ("Q. No. 1 Part (a)") — a single-answer question labels its one answer "Q. No. 1" too.
    render(
      <ESheetPreview
        template={template([
          {
            id: 'q1',
            questionNo: 1,
            type: 'mcq',
            answers: [
              { id: 'a1', maxMarks: 1 },
              { id: 'a2', maxMarks: 1 },
            ],
          },
          {
            id: 'q2',
            questionNo: 2,
            type: 'long-answer',
            answers: [
              { id: 'b1', maxMarks: 10, space: 'quarter' },
              { id: 'b2', maxMarks: 10, space: 'quarter' },
            ],
          },
        ])}
      />,
    );

    expect(screen.getByText('Q. No. 1')).toBeInTheDocument();
    expect(screen.getByText('MCQ')).toBeInTheDocument();
    expect(screen.getByText('Q. No. 2')).toBeInTheDocument();
    expect(screen.getByText('Long answer')).toBeInTheDocument();
    // MCQ rows are numbered inside their question; written answers carry the full label
    expect(screen.getByText('a.')).toBeInTheDocument();
    expect(screen.queryByText('Q. No. 1 Part (a)')).not.toBeInTheDocument();
    expect(screen.getByText('Q. No. 2 Part (b)')).toBeInTheDocument();
  });
});
