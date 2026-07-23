import { describe, expect, it } from 'vitest';

import { type Annotation } from '@oses/types';

import {
  colorToken,
  distanceToSegment,
  hitTest,
  isDragTool,
  isDrawable,
  outlinePoints,
  pointsRequired,
  simplifyStroke,
  strokeWidthFor,
  toBox,
  toPixels,
  toPolylinePoints,
  toRelativePoint,
} from './annotation-geometry';

const RECT = { left: 100, top: 50, width: 400, height: 200 };
const SIZE = { width: 400, height: 200 };

describe('toRelativePoint', () => {
  it('converts a pointer position to a fraction of the image', () => {
    expect(toRelativePoint(300, 150, RECT)).toEqual({ x: 0.5, y: 0.5 });
    expect(toRelativePoint(100, 50, RECT)).toEqual({ x: 0, y: 0 });
    expect(toRelativePoint(500, 250, RECT)).toEqual({ x: 1, y: 1 });
  });

  // A drag that runs off the edge must not store a point outside the image, or the
  // annotation reappears floating beside it.
  it('clamps a position outside the image to its edge', () => {
    expect(toRelativePoint(0, 0, RECT)).toEqual({ x: 0, y: 0 });
    expect(toRelativePoint(9999, 9999, RECT)).toEqual({ x: 1, y: 1 });
  });

  it('survives a zero-sized surface instead of dividing by zero', () => {
    const point = toRelativePoint(10, 10, { left: 0, top: 0, width: 0, height: 0 });
    expect(point).toEqual({ x: 0, y: 0 });
  });
});

describe('toPixels', () => {
  it('is the inverse of toRelativePoint for the same surface', () => {
    const relative = toRelativePoint(300, 150, RECT);
    const pixels = toPixels(relative, SIZE);
    expect(pixels).toEqual({ x: 200, y: 100 });
  });

  // The whole reason coordinates are stored as fractions: the same annotation must land
  // in the same place on a differently sized rendering.
  it('places the same annotation proportionally on a larger surface', () => {
    const relative = { x: 0.25, y: 0.5 };
    expect(toPixels(relative, { width: 400, height: 200 })).toEqual({ x: 100, y: 100 });
    expect(toPixels(relative, { width: 800, height: 400 })).toEqual({ x: 200, y: 200 });
  });
});

describe('tool geometry', () => {
  it('knows how many points each tool needs', () => {
    expect(pointsRequired('tick')).toBe(1);
    expect(pointsRequired('cross')).toBe(1);
    expect(pointsRequired('note')).toBe(1);
    expect(pointsRequired('rectangle')).toBe(2);
    expect(pointsRequired('ellipse')).toBe(2);
    expect(pointsRequired('arrow')).toBe(2);
    expect(pointsRequired('pen')).toBe('many');
    expect(pointsRequired('highlighter')).toBe('many');
  });

  it('treats only the single-point stamps as click tools', () => {
    expect(isDragTool('tick')).toBe(false);
    expect(isDragTool('pen')).toBe(true);
    expect(isDragTool('rectangle')).toBe(true);
  });

  it('draws the highlighter fatter than the pen', () => {
    expect(strokeWidthFor('highlighter')).toBeGreaterThan(strokeWidthFor('pen'));
  });
});

describe('toPolylinePoints', () => {
  it('formats points for an SVG polyline', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];
    expect(toPolylinePoints(points, SIZE)).toBe('0,0 200,100 400,200');
  });
});

describe('toBox', () => {
  it('builds a box from two corners', () => {
    const box = toBox({ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }, SIZE);
    expect(box).toEqual({ x: 100, y: 50, width: 200, height: 100 });
  });

  // Dragging up-and-left is just as valid as down-and-right.
  it('normalises a box dragged backwards', () => {
    const forwards = toBox({ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }, SIZE);
    const backwards = toBox({ x: 0.75, y: 0.75 }, { x: 0.25, y: 0.25 }, SIZE);
    expect(backwards).toEqual(forwards);
  });
});

describe('simplifyStroke', () => {
  it('drops points that are barely apart', () => {
    const dense = Array.from({ length: 100 }, (_, i) => ({ x: i * 0.0001, y: 0 }));
    expect(simplifyStroke(dense).length).toBeLessThan(dense.length);
  });

  it('keeps points that are genuinely apart', () => {
    const spread = [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.1 },
      { x: 0.6, y: 0.4 },
      { x: 1, y: 1 },
    ];
    expect(simplifyStroke(spread)).toEqual(spread);
  });

  // Dropping the last point would make the stroke visibly stop short of where it ended.
  it('always keeps the first and last point', () => {
    const dense = Array.from({ length: 50 }, (_, i) => ({ x: i * 0.0001, y: 0 }));
    const simplified = simplifyStroke(dense);
    expect(simplified[0]).toEqual(dense[0]);
    expect(simplified.at(-1)).toEqual(dense.at(-1));
  });

  it('leaves a two-point stroke alone', () => {
    const pair = [
      { x: 0, y: 0 },
      { x: 0.0001, y: 0 },
    ];
    expect(simplifyStroke(pair)).toEqual(pair);
  });
});

describe('isDrawable', () => {
  it('accepts a single-point stamp', () => {
    expect(isDrawable({ tool: 'tick', points: [{ x: 0.5, y: 0.5 }] })).toBe(true);
  });

  // A click that never moved leaves a rectangle with no width — keeping it would litter
  // the image with invisible annotations that still count and still get stored.
  it('rejects a drag tool that never moved', () => {
    expect(
      isDrawable({
        tool: 'rectangle',
        points: [
          { x: 0.5, y: 0.5 },
          { x: 0.5, y: 0.5 },
        ],
      }),
    ).toBe(false);
  });

  it('accepts a drag tool that covers real distance', () => {
    expect(
      isDrawable({
        tool: 'rectangle',
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.8, y: 0.6 },
        ],
      }),
    ).toBe(true);
  });

  it('rejects a drag tool with too few points', () => {
    expect(isDrawable({ tool: 'arrow', points: [{ x: 0.5, y: 0.5 }] })).toBe(false);
  });
});

describe('distanceToSegment', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };

  it('measures perpendicular distance to the line', () => {
    expect(distanceToSegment({ x: 50, y: 10 }, a, b)).toBe(10);
  });

  // Past the end of a segment the nearest point is the endpoint, not the infinite line.
  it('clamps to the endpoints rather than extending the line', () => {
    expect(distanceToSegment({ x: 200, y: 0 }, a, b)).toBe(100);
    expect(distanceToSegment({ x: -30, y: 0 }, a, b)).toBe(30);
  });

  it('treats a zero-length segment as a point', () => {
    expect(distanceToSegment({ x: 3, y: 4 }, a, a)).toBe(5);
  });
});

describe('outlinePoints', () => {
  it('traces a rectangle’s edges and closes it', () => {
    const points = outlinePoints(
      {
        tool: 'rectangle',
        points: [
          { x: 0.25, y: 0.25 },
          { x: 0.75, y: 0.75 },
        ],
      },
      SIZE,
    );
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual(points[4]);
  });

  it('samples an ellipse into a closed loop', () => {
    const points = outlinePoints(
      {
        tool: 'ellipse',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      SIZE,
    );
    expect(points.length).toBeGreaterThan(8);
    expect(points[0]?.x).toBeCloseTo(points.at(-1)!.x, 5);
  });

  it('uses a stroke’s own points', () => {
    const points = outlinePoints(
      {
        tool: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      SIZE,
    );
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 400, y: 200 },
    ]);
  });
});

describe('hitTest', () => {
  const stroke: Annotation = {
    id: 'stroke',
    tool: 'pen',
    points: [
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ],
    color: 'danger',
    createdAt: '2026-07-21T10:00:00.000Z',
  };

  it('finds a stroke the pointer is on', () => {
    expect(hitTest([stroke], { x: 200, y: 100 }, SIZE)?.id).toBe('stroke');
  });

  it('finds nothing when the pointer is clear of everything', () => {
    expect(hitTest([stroke], { x: 200, y: 190 }, SIZE)).toBeUndefined();
    expect(hitTest([], { x: 10, y: 10 }, SIZE)).toBeUndefined();
  });

  // Erasing must remove what the checker can see on top, not something buried under it.
  it('returns the most recently drawn mark when several overlap', () => {
    const under = { ...stroke, id: 'under' };
    const over = { ...stroke, id: 'over' };
    expect(hitTest([under, over], { x: 200, y: 100 }, SIZE)?.id).toBe('over');
  });

  // A highlighter is drawn far fatter than a pen, so it must be as easy to hit as it looks.
  it('gives a fat tool a wider reach than a thin one', () => {
    const pen = { ...stroke, tool: 'pen' as const };
    const highlighter = { ...stroke, tool: 'highlighter' as const };
    const justOutsideThePen = { x: 200, y: 100 + 12 };
    expect(hitTest([pen], justOutsideThePen, SIZE)).toBeUndefined();
    expect(hitTest([highlighter], justOutsideThePen, SIZE)?.id).toBe('stroke');
  });

  it('hits a stamp near its point', () => {
    const tick: Annotation = {
      id: 'tick',
      tool: 'tick',
      points: [{ x: 0.5, y: 0.5 }],
      color: 'success',
      createdAt: '2026-07-21T10:00:00.000Z',
    };
    expect(hitTest([tick], { x: 200, y: 100 }, SIZE)?.id).toBe('tick');
    expect(hitTest([tick], { x: 380, y: 190 }, SIZE)).toBeUndefined();
  });

  // A box drawn around some working must be erased by its edge. If clicking anywhere
  // inside counted, a large box would swallow every click within it.
  it('hits a rectangle on its edge but not in its empty middle', () => {
    const box: Annotation = {
      id: 'box',
      tool: 'rectangle',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.8 },
      ],
      color: 'danger',
      createdAt: '2026-07-21T10:00:00.000Z',
    };
    // On the top edge (y = 0.2 * 200 = 40).
    expect(hitTest([box], { x: 200, y: 40 }, SIZE)?.id).toBe('box');
    // Dead centre — inside, but not on the outline.
    expect(hitTest([box], { x: 200, y: 100 }, SIZE)).toBeUndefined();
  });
});

describe('colorToken', () => {
  // Reserved meanings: green correct, red incorrect, amber partial. Theme tokens only —
  // a raw hex here would ignore the light/dark theme and the accent switcher.
  it('maps every colour to a theme token', () => {
    expect(colorToken('success')).toBe('var(--color-success)');
    expect(colorToken('danger')).toBe('var(--color-danger)');
    expect(colorToken('warning')).toBe('var(--color-warning)');
    expect(colorToken('brand')).toBe('var(--brand)');
  });
});
