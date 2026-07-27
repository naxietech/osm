import { describe, expect, it } from 'vitest';

import type {
  ESheetAnswerBlock,
  ESheetAnswerSpace,
  ESheetPage,
  ESheetQuestionType,
  ESheetTemplate,
  ESheetTemplateAnswer,
  ESheetTemplateQuestion,
} from '@oses/types';

import {
  GEOMETRY,
  instructionsHeightMm,
  layoutRegions,
  layoutTemplate,
  linesForSpace,
  maxLinesPerSide,
  spaceSummary,
} from './e-sheet-layout';

/**
 * Expected geometry, worked out by hand from GEOMETRY so these tests fail if the constants
 * move rather than silently agreeing with whatever the code now does:
 *
 *   content top     = margin 15 + header 12            = 27mm
 *   content bottom  = 297 - margin 15                  = 282mm
 *   content height                                     = 255mm
 *   answer chrome   = label 6 + box padding 4          = 10mm
 *   heading + gap   = 8 + 4                            = 12mm
 *   max lines, no heading  = floor((255 - 10) / 8)     = 30
 *   max lines, with heading = floor((255 - 12 - 10)/8) = 29
 *   roll grid       = label 5 + boxes 10 + 10 rows x 7.5              = 90mm
 *   cover, no MCQ   = pad 8 + title 10 + roll 90 + gap 4 + 4 rows x 12 = 160mm
 *   cover, with MCQ = 160 + gap 4 + bubble legend 16                   = 180mm
 *   a bubble row is 9mm and pays no label row, so the MCQ grid runs on a 9mm pitch
 *
 * PAGE 1 IS ALWAYS THE COVER, so questions begin on page 2 and pages[0] never holds answers.
 */
const CONTENT_TOP = 27;
const CONTENT_BOTTOM = 282;

function answer(id: string, maxMarks: number, space?: ESheetAnswerSpace): ESheetTemplateAnswer {
  return { id, maxMarks, ...(space === undefined ? {} : { space }) };
}

function question(
  questionNo: number,
  type: ESheetQuestionType,
  answers: ESheetTemplateAnswer[],
  optionCount?: number,
  defaultSpace?: ESheetAnswerSpace,
): ESheetTemplateQuestion {
  return {
    id: `q_${questionNo}`,
    questionNo,
    type,
    answers,
    ...(optionCount ? { optionCount } : {}),
    ...(defaultSpace ? { defaultSpace } : {}),
  };
}

function template(questions: ESheetTemplateQuestion[], instructions?: string): ESheetTemplate {
  return {
    id: 'tpl_test',
    name: 'Test Template',
    questions,
    isActive: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...(instructions === undefined ? {} : { instructions }),
  };
}

/** Answer blocks on one page, in printed order. */
function answersOn(page: ESheetPage | undefined): ESheetAnswerBlock[] {
  return (page?.blocks ?? []).filter((b): b is ESheetAnswerBlock => b.kind === 'answer');
}

/** A block's top and bottom edge back in millimetres. */
function edgesMm(rect: { y: number; height: number }): { top: number; bottom: number } {
  const top = rect.y * GEOMETRY.pageHeightMm;
  return { top, bottom: top + rect.height * GEOMETRY.pageHeightMm };
}

describe('maxLinesPerSide', () => {
  it('holds 30 lines alone, 29 when it also carries a question heading', () => {
    expect(maxLinesPerSide(false)).toBe(30);
    expect(maxLinesPerSide(true)).toBe(29);
  });
});

describe('instructionsHeightMm', () => {
  it('reserves nothing when there is nothing to print', () => {
    expect(instructionsHeightMm(undefined)).toBe(0);
    expect(instructionsHeightMm('')).toBe(0);
    expect(instructionsHeightMm('   \n  ')).toBe(0);
  });

  it('reserves padding plus one slot per line', () => {
    // 6 padding + 1 line x 5
    expect(instructionsHeightMm('Write inside the boxes.')).toBe(11);
    // 6 padding + 3 lines x 5
    expect(instructionsHeightMm('One\nTwo\nThree')).toBe(21);
  });

  it('counts a long line as the several lines it wraps to', () => {
    // 200 chars / 95 per line -> 3 wrapped lines -> 6 + 15
    expect(instructionsHeightMm('x'.repeat(200))).toBe(21);
  });
});

describe('layoutTemplate', () => {
  it('makes page 1 an information cover and puts nothing else on it', () => {
    const layout = layoutTemplate(template([question(1, 'mcq', [answer('a1', 1)])]));

    const cover = layout.pages[0]?.blocks[0];
    expect(cover?.kind).toBe('cover');
    expect(edgesMm(cover?.rect ?? { y: 0, height: 0 }).top).toBeCloseTo(CONTENT_TOP, 3);
    expect(layout.pages[0]?.blocks.map((b) => b.kind)).toEqual(['cover']);
    expect(answersOn(layout.pages[0])).toHaveLength(0);
  });

  it('asks the cover for every candidate and exam detail, plus a QR', () => {
    const layout = layoutTemplate(template([question(1, 'mcq', [answer('a1', 1)])]));
    const cover = layout.pages[0]?.blocks[0];

    expect(cover?.kind === 'cover' && cover.hasQr).toBe(true);
    expect(cover?.kind === 'cover' ? cover.fields : []).toEqual([
      'roll-number',
      'school',
      'class',
      'subject',
      'student-name',
      'date',
    ]);
  });

  it('prints the bubble legend only when the paper has machine-read questions', () => {
    const withMcq = layoutTemplate(template([question(1, 'mcq', [answer('a1', 1)])]));
    const written = layoutTemplate(
      template([question(1, 'short-answer', [answer('a1', 3, 'quarter')])]),
    );

    const cover = (l: ReturnType<typeof layoutTemplate>): boolean => {
      const block = l.pages[0]?.blocks[0];
      return block?.kind === 'cover' ? block.showsMarkingLegend : false;
    };
    expect(cover(withMcq)).toBe(true);
    expect(cover(written)).toBe(false);

    // and the legend costs the cover 20mm of height (gap 4 + legend 16)
    const heightOf = (l: ReturnType<typeof layoutTemplate>): number =>
      (l.pages[0]?.blocks[0]?.rect.height ?? 0) * GEOMETRY.pageHeightMm;
    expect(heightOf(withMcq) - heightOf(written)).toBeCloseTo(20, 3);
  });

  it('leaves a template with no questions as a cover on its own', () => {
    const layout = layoutTemplate(template([]));
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0]?.blocks.map((b) => b.kind)).toEqual(['cover']);
  });

  it('starts the first question on page 2, never on the cover', () => {
    const layout = layoutTemplate(template([question(1, 'mcq', [answer('a1', 1)])]));

    expect(layout.pages).toHaveLength(2);
    expect(answersOn(layout.pages[1]).map((b) => b.label)).toEqual(['a.']);
  });

  it('places the instructions block after the cover block, and omits it when blank', () => {
    const withText = layoutTemplate(
      template([question(1, 'mcq', [answer('a1', 1)])], 'Write inside the boxes.'),
    );
    expect(withText.pages[0]?.blocks[1]?.kind).toBe('instructions');
    // this template has an MCQ, so the cover carries the bubble legend: 180mm.
    // it ends at 27 + 180 = 207, + 4 gap = 211
    expect(edgesMm(withText.pages[0]?.blocks[1]?.rect ?? { y: 0, height: 0 }).top).toBeCloseTo(
      211,
      3,
    );

    const without = layoutTemplate(template([question(1, 'mcq', [answer('a1', 1)])]));
    expect(without.pages[0]?.blocks.some((b) => b.kind === 'instructions')).toBe(false);
  });

  it('prints one bubble row per MCQ answer, using the question option count', () => {
    const layout = layoutTemplate(
      template([question(1, 'mcq', [answer('a1', 1), answer('a2', 1)], 5)]),
    );

    const blocks = answersOn(layout.pages[1]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.content).toEqual({ kind: 'bubbles', optionCount: 5 });
    expect(blocks[1]?.content).toEqual({ kind: 'bubbles', optionCount: 5 });
  });

  it('defaults MCQ bubbles to 4 when the question does not say', () => {
    const layout = layoutTemplate(template([question(1, 'mcq', [answer('a1', 1)])]));
    expect(answersOn(layout.pages[1])[0]?.content).toEqual({ kind: 'bubbles', optionCount: 4 });
  });

  it('numbers MCQ rows inside the question, without the question number', () => {
    const layout = layoutTemplate(
      template([
        question(3, 'mcq', [answer('m1', 1), answer('m2', 1), answer('m3', 1)]),
        { ...question(4, 'mcq', [answer('n1', 1), answer('n2', 1)]), subPartLabelStyle: 'roman' },
      ]),
    );

    // The heading above the grid already says which question it is, so a row is just "a." / "i.".
    expect(answersOn(layout.pages[1]).map((b) => b.label)).toEqual(['a.', 'b.', 'c.']);
    expect(answersOn(layout.pages[2]).map((b) => b.label)).toEqual(['i.', 'ii.']);
  });

  it('still spells a written answer out in full, unlike an MCQ row', () => {
    const layout = layoutTemplate(
      template([
        question(1, 'mcq', [answer('m1', 1)]),
        question(2, 'short-answer', [answer('s1', 3, 'quarter'), answer('s2', 3, 'quarter')]),
      ]),
    );

    expect(answersOn(layout.pages[1]).map((b) => b.label)).toEqual(['a.']);
    // a written answer is cropped and marked alone, so its label has to stand by itself
    expect(answersOn(layout.pages[2]).map((b) => b.label)).toEqual([
      'Q. No. 2 Part (a)',
      'Q. No. 2 Part (b)',
    ]);
  });

  it('labels a lone answer "Q4" and several "Q4(a)", "Q4(b)"', () => {
    const layout = layoutTemplate(
      template([
        question(4, 'short-answer', [answer('a1', 3, 'quarter')]),
        question(5, 'short-answer', [answer('b1', 3, 'quarter'), answer('b2', 3, 'quarter')]),
      ]),
    );

    const labels = layout.pages.flatMap((p) => answersOn(p).map((b) => b.label));
    expect(labels).toEqual(['Q. No. 4', 'Q. No. 5 Part (a)', 'Q. No. 5 Part (b)']);
  });

  it('moves a whole answer to the next side rather than straddling the break', () => {
    // Q1 opens page 2 with the full 255mm: cursor 27.
    // (a) is a full side: heading 12 + chrome 10 + 29 lines x 8 = 254 -> fills the page
    // (b) needs another full side -> the whole answer moves to page 3
    const layout = layoutTemplate(
      template([question(1, 'short-answer', [answer('a1', 10, 'full'), answer('a2', 10, 'full')])]),
    );

    expect(layout.pages).toHaveLength(3);
    expect(answersOn(layout.pages[1]).map((b) => b.label)).toEqual(['Q. No. 1 Part (a)']);
    expect(answersOn(layout.pages[2]).map((b) => b.label)).toEqual(['Q. No. 1 Part (b)']);
    // neither is a slice — each is one clean crop
    expect(answersOn(layout.pages[1])[0]?.continuation).toBeUndefined();
    expect(answersOn(layout.pages[2])[0]?.continuation).toBeUndefined();
  });

  it('keeps a question heading with its first answer instead of orphaning it', () => {
    // Q1(a) 20 lines fills most of page 1; Q2 must not leave its heading behind.
    const layout = layoutTemplate(
      template([
        question(1, 'short-answer', [answer('a1', 10, 'full')]),
        question(2, 'short-answer', [answer('b1', 10, 'full')]),
      ]),
    );

    expect(layout.pages).toHaveLength(3);
    expect(layout.pages[0]?.blocks.map((b) => b.kind)).toEqual(['cover']);
    expect(layout.pages[1]?.blocks.map((b) => b.kind)).toEqual(['question-heading', 'answer']);
    expect(layout.pages[2]?.blocks.map((b) => b.kind)).toEqual(['question-heading', 'answer']);
  });

  it('splits an oversized answer into whole sides, starting on a fresh one', () => {
    // two sides = 58 lines, and a side holds 29 -> two full slices, on pages 2 and 3
    // because page 1 is the cover.
    const layout = layoutTemplate(
      template([question(1, 'long-answer', [answer('a1', 20, 'two-sides')])]),
    );

    expect(layout.pages).toHaveLength(3);
    expect(answersOn(layout.pages[0])).toHaveLength(0); // cover only
    const first = answersOn(layout.pages[1])[0];
    const second = answersOn(layout.pages[2])[0];

    expect(first?.content).toEqual({ kind: 'writing', lineCount: 29 });
    expect(second?.content).toEqual({ kind: 'writing', lineCount: 29 });
    expect(first?.continuation).toEqual({ index: 1, total: 2 });
    expect(second?.continuation).toEqual({ index: 2, total: 2 });
    // both slices describe the same answer, so both carry its id and label
    expect(first?.answerId).toBe('a1');
    expect(second?.answerId).toBe('a1');
    expect(second?.label).toBe('Q. No. 1');
  });

  it('starts every question on its own page', () => {
    // Three tiny questions that would easily share a side — each still gets its own.
    const layout = layoutTemplate(
      template([
        question(1, 'mcq', [answer('m1', 1)]),
        question(2, 'mcq', [answer('m2', 1)]),
        question(3, 'short-answer', [answer('s1', 3, 'quarter')]),
      ]),
    );

    expect(layout.pages).toHaveLength(4); // the cover, then one page each
    expect(layout.pages.map((p) => answersOn(p).map((b) => b.label))).toEqual([
      [], // the cover
      ['a.'], // MCQ rows are numbered inside their question
      ['a.'],
      ['Q. No. 3'],
    ]);
  });

  it('keeps one question’s sub-parts together on its page while they fit', () => {
    const layout = layoutTemplate(
      template([
        question(1, 'short-answer', [
          answer('a1', 3, 'quarter'),
          answer('a2', 3, 'quarter'),
          answer('a3', 3, 'quarter'),
        ]),
        question(2, 'short-answer', [answer('b1', 3, 'quarter')]),
      ]),
    );

    expect(layout.pages).toHaveLength(3);
    expect(answersOn(layout.pages[1]).map((b) => b.label)).toEqual([
      'Q. No. 1 Part (a)',
      'Q. No. 1 Part (b)',
      'Q. No. 1 Part (c)',
    ]);
    expect(answersOn(layout.pages[2]).map((b) => b.label)).toEqual(['Q. No. 2']);
  });

  it('numbers each question’s sub-parts in its own style', () => {
    const parts = (prefix: string): ESheetTemplateAnswer[] => [
      answer(prefix + '1', 3, 'quarter'),
      answer(prefix + '2', 3, 'quarter'),
      answer(prefix + '3', 3, 'quarter'),
      answer(prefix + '4', 3, 'quarter'),
    ];

    const layout = layoutTemplate(
      template([
        question(1, 'short-answer', parts('a')),
        { ...question(2, 'short-answer', parts('b')), subPartLabelStyle: 'roman' },
        { ...question(3, 'short-answer', parts('c')), subPartLabelStyle: 'alpha' },
      ]),
    );

    // one paper, three questions, numbering set per question
    expect(answersOn(layout.pages[1]).map((b) => b.label)).toEqual([
      'Q. No. 1 Part (a)',
      'Q. No. 1 Part (b)',
      'Q. No. 1 Part (c)',
      'Q. No. 1 Part (d)',
    ]);
    expect(answersOn(layout.pages[2]).map((b) => b.label)).toEqual([
      'Q. No. 2 Part (i)',
      'Q. No. 2 Part (ii)',
      'Q. No. 2 Part (iii)',
      'Q. No. 2 Part (iv)',
    ]);
    expect(answersOn(layout.pages[3]).map((b) => b.label)).toEqual([
      'Q. No. 3 Part (a)',
      'Q. No. 3 Part (b)',
      'Q. No. 3 Part (c)',
      'Q. No. 3 Part (d)',
    ]);
  });

  it('counts marks and answers across every question', () => {
    const layout = layoutTemplate(
      template([
        question(1, 'mcq', [answer('a1', 1), answer('a2', 1), answer('a3', 1)]),
        question(2, 'short-answer', [answer('b1', 3, 'quarter'), answer('b2', 4, 'quarter')]),
      ]),
    );

    expect(layout.answerCount).toBe(5);
    expect(layout.totalMarks).toBe(10);
  });

  it('skips a question with no answers instead of printing a bare heading', () => {
    const layout = layoutTemplate(
      template([question(1, 'short-answer', []), question(2, 'mcq', [answer('b1', 1)])]),
    );

    const headings = layout.pages
      .flatMap((p) => p.blocks)
      .filter((b) => b.kind === 'question-heading');
    expect(headings).toHaveLength(1);
    expect(layout.answerCount).toBe(1);
  });

  it('gives an answer its question default, and lets one part override it', () => {
    const layout = layoutTemplate(
      template([
        question(
          1,
          'short-answer',
          [answer('a1', 3), answer('a2', 3, 'full'), answer('a3', 3)],
          undefined,
          'quarter',
        ),
      ]),
    );

    const lines = layout.pages
      .flatMap((p) => answersOn(p))
      .map((b) => (b.content.kind === 'writing' ? b.content.lineCount : -1));

    expect(lines).toEqual([
      linesForSpace('quarter'),
      linesForSpace('full'),
      linesForSpace('quarter'),
    ]);
  });

  it('falls back to a quarter side when neither the answer nor its question says', () => {
    const layout = layoutTemplate(template([question(1, 'short-answer', [answer('a1', 3)])]));
    expect(answersOn(layout.pages[1])[0]?.content).toEqual({
      kind: 'writing',
      lineCount: linesForSpace('quarter'),
    });
  });

  it('emits rectangles as page fractions, margins included', () => {
    const layout = layoutTemplate(template([question(1, 'mcq', [answer('a1', 1)])]));
    const block = answersOn(layout.pages[1])[0];

    // x = 15/210, width = 180/210
    expect(block?.rect.x).toBe(0.071429);
    expect(block?.rect.width).toBe(0.857143);
    // on page 2 the heading sits at 27, so the answer box starts at 27 + 12 = 39
    expect(edgesMm(block?.rect ?? { y: 0, height: 0 }).top).toBeCloseTo(39, 3);
    // a bubble row is the row itself — 9mm, with no label row above it
    expect(block?.rect.height).toBe(Number((9 / 297).toFixed(6)));
  });

  describe('invariants on a realistic paper', () => {
    // 12 MCQs, two short-answer questions, one long answer split over sides.
    const layout = layoutTemplate(
      template(
        [
          question(
            1,
            'mcq',
            Array.from({ length: 12 }, (_, i) => answer(`m${i}`, 1)),
          ),
          question(
            2,
            'short-answer',
            Array.from({ length: 5 }, (_, i) => answer(`s${i}`, 3, 'quarter')),
          ),
          question(
            3,
            'short-answer',
            Array.from({ length: 6 }, (_, i) => answer(`t${i}`, 3, 'quarter')),
          ),
          question(4, 'long-answer', [answer('l1', 12, 'full'), answer('l2', 8, 'two-sides')]),
        ],
        'Write inside the boxes only.\nFill bubbles completely.',
      ),
    );

    it('never lets a block run past the bottom margin', () => {
      for (const page of layout.pages) {
        for (const block of page.blocks) {
          expect(edgesMm(block.rect).bottom).toBeLessThanOrEqual(CONTENT_BOTTOM + 0.001);
        }
      }
    });

    it('never lets a block start above the header', () => {
      for (const page of layout.pages) {
        for (const block of page.blocks) {
          expect(edgesMm(block.rect).top).toBeGreaterThanOrEqual(CONTENT_TOP - 0.001);
        }
      }
    });

    it('never overlaps two blocks on the same page', () => {
      for (const page of layout.pages) {
        const spans = page.blocks.map((b) => edgesMm(b.rect));
        for (let i = 1; i < spans.length; i += 1) {
          const previous = spans[i - 1];
          const current = spans[i];
          if (!previous || !current) continue;
          expect(current.top).toBeGreaterThanOrEqual(previous.bottom - 0.001);
        }
      }
    });

    it('numbers pages 1..n with no gaps', () => {
      expect(layout.pages.map((p) => p.pageNumber)).toEqual(
        Array.from({ length: layout.pages.length }, (_, i) => i + 1),
      );
    });

    it('gives every answer its full writing space across all its slices', () => {
      const linesById = new Map<string, number>();
      for (const page of layout.pages) {
        for (const block of answersOn(page)) {
          if (block.content.kind !== 'writing') continue;
          linesById.set(
            block.answerId,
            (linesById.get(block.answerId) ?? 0) + block.content.lineCount,
          );
        }
      }
      expect(linesById.get('s0')).toBe(linesForSpace('quarter'));
      expect(linesById.get('l1')).toBe(linesForSpace('full'));
      // split across sides, but nothing lost
      expect(linesById.get('l2')).toBe(linesForSpace('two-sides'));
    });

    it('places every answer exactly once, counting slices as one answer', () => {
      const ids = new Set(layout.pages.flatMap((p) => answersOn(p)).map((b) => b.answerId));
      expect(ids.size).toBe(layout.answerCount);
    });
  });
});

describe('layoutRegions', () => {
  it('gives a written answer one region per slice, carrying its page and kind', () => {
    const layout = layoutTemplate(
      template([question(1, 'long-answer', [answer('l1', 20, 'two-sides')])]),
    );

    const slices = layoutRegions(layout).filter((r) => r.answerIds.includes('l1'));
    expect(slices).toHaveLength(2);
    expect(slices.map((s) => s.pageNumber)).toEqual([2, 3]);
    expect(slices.every((s) => s.contentKind === 'writing')).toBe(true);
    expect(slices[1]?.continuation).toEqual({ index: 2, total: 2 });
  });

  it('merges a question’s bubble rows into ONE region — MCQ sub-parts are not segmented', () => {
    const layout = layoutTemplate(
      template([question(1, 'mcq', [answer('m1', 1), answer('m2', 1), answer('m3', 1)])]),
    );

    const regions = layoutRegions(layout);
    expect(regions).toHaveLength(1);

    const grid = regions[0];
    expect(grid?.answerIds).toEqual(['m1', 'm2', 'm3']);
    expect(grid?.contentKind).toBe('bubbles');
    expect(grid?.label).toBe('Q. No. 1');
    expect(grid?.maxMarks).toBe(3); // the grid's combined marks
  });

  it('spans the bubble region across every row of its grid', () => {
    const layout = layoutTemplate(
      template([question(1, 'mcq', [answer('m1', 1), answer('m2', 1)])]),
    );
    const grid = layoutRegions(layout)[0];
    const rows = layout.pages
      .flatMap((p) => answersOn(p))
      .filter((b) => b.content.kind === 'bubbles');

    const firstRow = rows[0]?.rect;
    const lastRow = rows[rows.length - 1]?.rect;
    expect(grid?.rect.y).toBeCloseTo(firstRow?.y ?? -1, 5);
    expect(grid?.rect.y ?? 0).toBeLessThan(lastRow?.y ?? 0);
    // the region reaches the bottom of the last row
    expect((grid?.rect.y ?? 0) + (grid?.rect.height ?? 0)).toBeCloseTo(
      (lastRow?.y ?? 0) + (lastRow?.height ?? 0),
      5,
    );
  });

  it('keeps separate questions in separate regions', () => {
    const layout = layoutTemplate(
      template([
        question(1, 'mcq', [answer('m1', 1), answer('m2', 1)]),
        question(2, 'mcq', [answer('n1', 1)]),
        question(3, 'short-answer', [answer('s1', 3, 'quarter')]),
      ]),
    );

    const regions = layoutRegions(layout);
    expect(regions).toHaveLength(3);
    expect(regions.filter((r) => r.contentKind === 'bubbles')).toHaveLength(2);
    expect(regions.filter((r) => r.contentKind === 'writing')).toHaveLength(1);
  });

  it('returns nothing for a template with no answers', () => {
    expect(layoutRegions(layoutTemplate(template([])))).toEqual([]);
  });
});

describe('linesForSpace', () => {
  it('makes a full side exactly one page — 29 lines, not 30', () => {
    expect(linesForSpace('full')).toBe(29);
    // 29 fills a page; one more would spill onto the next
    const fits = layoutTemplate(template([question(1, 'long-answer', [answer('a1', 10, 'full')])]));
    expect(fits.pages).toHaveLength(2); // cover + one page
  });

  it('sizes the fractions so that many really do share one side', () => {
    for (const [space, perSide] of [
      ['quarter', 4],
      ['third', 3],
      ['half', 2],
    ] as const) {
      const answers = Array.from({ length: perSide }, (_, i) => answer(`a${i}`, 3, space));
      const layout = layoutTemplate(template([question(1, 'short-answer', answers)]));
      // cover + exactly one page holding all of them
      expect(layout.pages, space).toHaveLength(2);
      expect(answersOn(layout.pages[1])).toHaveLength(perSide);
    }
  });

  it('rejects one more than a side holds, which is the point of the sizing', () => {
    const layout = layoutTemplate(
      template([
        question(
          1,
          'short-answer',
          Array.from({ length: 5 }, (_, i) => answer(`a${i}`, 3, 'quarter')),
        ),
      ]),
    );
    expect(layout.pages).toHaveLength(3); // the fifth quarter spills to its own page
  });

  it('makes two sides twice a full one', () => {
    expect(linesForSpace('two-sides')).toBe(2 * linesForSpace('full'));
  });
});

describe('spaceSummary', () => {
  it('says what a chosen share actually buys', () => {
    expect(spaceSummary('full')).toBe('29 lines');
    expect(spaceSummary('half')).toBe(`${linesForSpace('half')} lines`);
    expect(spaceSummary('two-sides')).toBe(`${linesForSpace('two-sides')} lines · 2 sides`);
  });
});
