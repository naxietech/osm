/**
 * Pure geometry for the annotation layer.
 *
 * Annotations are stored as fractions of the image (0–1) but drawn in pixels, so every
 * conversion lives here rather than inside the component: this is the part that can be
 * tested exactly, while the pointer-dragging around it cannot.
 */
import { type Annotation, type AnnotationColor, type AnnotationPoint } from '@oses/types';

/** Size of the drawing surface, in pixels. */
export interface CanvasSize {
  width: number;
  height: number;
}

/** Keep a fraction inside the image. A drag that leaves the edge must not store 1.4. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Convert a pointer position to a stored point. `rect` is the drawing surface's position
 * on screen, so this works unchanged when the image is scrolled, zoomed or resized.
 */
export function toRelativePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): AnnotationPoint {
  // A zero-sized rect would divide by zero; treat it as the origin.
  const x = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
  const y = rect.height === 0 ? 0 : (clientY - rect.top) / rect.height;
  return { x: clamp01(x), y: clamp01(y) };
}

/** Convert a stored point back to pixels for rendering. */
export function toPixels(point: AnnotationPoint, size: CanvasSize): { x: number; y: number } {
  return { x: point.x * size.width, y: point.y * size.height };
}

/** How many points a tool's geometry needs. */
export function pointsRequired(annotation: Annotation['tool']): 1 | 2 | 'many' {
  switch (annotation) {
    case 'tick':
    case 'cross':
    case 'note':
      return 1;
    case 'rectangle':
    case 'ellipse':
    case 'arrow':
      return 2;
    default:
      return 'many';
  }
}

/** True when the tool is drawn by dragging rather than by a single click. */
export function isDragTool(tool: Annotation['tool']): boolean {
  return pointsRequired(tool) !== 1;
}

/** `x,y x,y ...` for an SVG polyline. */
export function toPolylinePoints(points: AnnotationPoint[], size: CanvasSize): string {
  return points
    .map((point) => {
      const { x, y } = toPixels(point, size);
      return `${x},${y}`;
    })
    .join(' ');
}

/** The axis-aligned box between two corners, whichever way round they were dragged. */
export function toBox(
  a: AnnotationPoint,
  b: AnnotationPoint,
  size: CanvasSize,
): { x: number; y: number; width: number; height: number } {
  const p1 = toPixels(a, size);
  const p2 = toPixels(b, size);
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  };
}

/**
 * Drop points that are barely apart. A freehand stroke fires a pointer event every few
 * pixels, so an unfiltered stroke stores hundreds of near-identical points; this keeps
 * the shape while making the stored annotation a fraction of the size.
 */
export function simplifyStroke(points: AnnotationPoint[], minDistance = 0.004): AnnotationPoint[] {
  if (points.length <= 2) return points;

  const kept: AnnotationPoint[] = [points[0]!];
  for (const point of points.slice(1, -1)) {
    const last = kept[kept.length - 1]!;
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    if (Math.hypot(dx, dy) >= minDistance) kept.push(point);
  }
  // Always keep the final point, or the stroke visibly falls short of where it ended.
  kept.push(points[points.length - 1]!);
  return kept;
}

/** Theme token for an annotation colour. Never a raw hex — these follow the theme. */
export function colorToken(color: AnnotationColor): string {
  switch (color) {
    case 'success':
      return 'var(--color-success)';
    case 'danger':
      return 'var(--color-danger)';
    case 'warning':
      return 'var(--color-warning)';
    default:
      return 'var(--brand)';
  }
}

/** Stroke width in pixels. A highlighter is deliberately fat and translucent. */
export function strokeWidthFor(tool: Annotation['tool']): number {
  if (tool === 'highlighter') return 14;
  if (tool === 'pen') return 2.5;
  return 2;
}

/** Highlighter is the only translucent tool, so it can be drawn over writing. */
export function opacityFor(tool: Annotation['tool']): number {
  return tool === 'highlighter' ? 0.35 : 1;
}

/** Shortest distance from a point to a line segment, in pixels. */
export function distanceToSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  // A zero-length segment is just a point.
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);

  // How far along the segment the nearest point lies, clamped to its ends.
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * The pixel outline of an annotation — what the eraser measures against.
 *
 * Shapes give their OUTLINE rather than their filled area, so erasing a rectangle drawn
 * around some working means clicking its edge, not clicking anywhere inside it. Otherwise
 * a big box would swallow every click within it.
 */
export function outlinePoints(
  annotation: Pick<Annotation, 'tool' | 'points'>,
  size: CanvasSize,
): { x: number; y: number }[] {
  const first = annotation.points[0];
  if (!first) return [];
  const last = annotation.points[annotation.points.length - 1]!;

  switch (annotation.tool) {
    case 'rectangle': {
      const box = toBox(first, last, size);
      const { x, y, width: w, height: h } = box;
      return [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
        { x, y },
      ];
    }
    case 'ellipse': {
      const box = toBox(first, last, size);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const rx = box.width / 2;
      const ry = box.height / 2;
      // Sampled rather than solved: 32 points trace the outline closely enough to click.
      return Array.from({ length: 33 }, (_, i) => {
        const angle = (i / 32) * Math.PI * 2;
        return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
      });
    }
    default:
      return annotation.points.map((point) => toPixels(point, size));
  }
}

/**
 * The annotation under a point, or undefined. Searched newest-first so the mark drawn on
 * top is the one erased — which is what the checker sees and therefore expects.
 */
export function hitTest(
  annotations: Annotation[],
  point: { x: number; y: number },
  size: CanvasSize,
  tolerance = 8,
): Annotation | undefined {
  for (let i = annotations.length - 1; i >= 0; i -= 1) {
    const annotation = annotations[i]!;
    const outline = outlinePoints(annotation, size);
    if (outline.length === 0) continue;

    // A fat highlighter must be as easy to hit as it is to see.
    const reach = tolerance + strokeWidthFor(annotation.tool) / 2;

    if (outline.length === 1) {
      // Stamps and pins are small glyphs drawn around their point.
      if (Math.hypot(point.x - outline[0]!.x, point.y - outline[0]!.y) <= reach + 9) {
        return annotation;
      }
      continue;
    }

    for (let j = 0; j < outline.length - 1; j += 1) {
      if (distanceToSegment(point, outline[j]!, outline[j + 1]!) <= reach) return annotation;
    }
  }
  return undefined;
}

/**
 * True when an annotation has enough geometry to be worth keeping. A click that never
 * moved leaves a drag tool with two identical points and nothing to show.
 */
export function isDrawable(annotation: Pick<Annotation, 'tool' | 'points'>): boolean {
  const required = pointsRequired(annotation.tool);
  if (required === 1) return annotation.points.length >= 1;
  if (annotation.points.length < 2) return false;

  const first = annotation.points[0]!;
  const last = annotation.points[annotation.points.length - 1]!;
  return Math.hypot(last.x - first.x, last.y - first.y) >= 0.005;
}
