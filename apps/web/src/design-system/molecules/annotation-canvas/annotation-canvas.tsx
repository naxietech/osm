import React, { useCallback, useEffect, useRef, useState } from 'react';

import { type Annotation, type AnnotationColor, type AnnotationPoint } from '@oses/types';

import { cn } from '@/lib/utils';

import {
  type CanvasSize,
  hitTest,
  isDragTool,
  isDrawable,
  pointsRequired,
  simplifyStroke,
  toPixels,
} from './annotation-geometry';
import { AnnotationShape } from './annotation-shape';

/**
 * The tools a caller can put in the user's hand.
 *
 * `eraser` and `none` are deliberately NOT annotation kinds — nothing is ever stored as an
 * eraser. They exist only as modes of this component, which is why they are not in
 * `@oses/types`.
 */
export type AnnotationCanvasTool = Annotation['tool'] | 'none' | 'eraser';

export interface AnnotationCanvasProps {
  /** The cropped answer image. */
  imageUrl: string;
  /** Describes the image for screen readers. Must not identify the candidate. */
  imageAlt: string;
  annotations: Annotation[];
  /** Emitted with the full new list whenever an annotation is added. */
  onChange?: (annotations: Annotation[]) => void;
  /** The tool in hand. `none` disables drawing without changing anything else. */
  tool?: AnnotationCanvasTool;
  color?: AnnotationColor;
  /** Asks the caller for the text of a pinned note. Return null to cancel. */
  onRequestNoteText?: () => string | null;
  className?: string;
}

/** Eraser reach for a fingertip, in pixels. Roughly a finger's contact patch. */
const TOUCH_TOLERANCE = 18;

let annotationCounter = 0;
function nextAnnotationId(): string {
  annotationCounter += 1;
  return `ann_${annotationCounter}`;
}

/**
 * The answer image with a drawing layer over it.
 *
 * Presentational and domain-free: it takes an image and a list of annotations, and emits
 * a new list. It knows nothing about marking, bands or candidates — which is what lets it
 * be tested and reused without dragging the marking flow along with it.
 *
 * Coordinates are stored as fractions of the image, so annotations stay put when the
 * image is resized or shown at a different scale. The conversion is measured from the
 * live element, so scrolling and zooming need no special handling.
 */
export function AnnotationCanvas({
  imageUrl,
  imageAlt,
  annotations,
  onChange,
  tool = 'none',
  color = 'danger',
  onRequestNoteText,
  className,
}: AnnotationCanvasProps): React.ReactElement {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [erasing, setErasing] = useState(false);

  const readOnly = tool === 'none' || !onChange;

  // The surface can change size without the window resizing — a sidebar opening, the
  // image loading — so observe the element rather than listening for window resize.
  useEffect(() => {
    const element = surfaceRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const measure = (): void => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pointFrom = useCallback((event: React.PointerEvent): AnnotationPoint => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = rect.width === 0 ? 0 : (event.clientX - rect.left) / rect.width;
    const y = rect.height === 0 ? 0 : (event.clientY - rect.top) / rect.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }, []);

  const commit = useCallback(
    (annotation: Annotation): void => {
      if (!onChange) return;
      if (!isDrawable(annotation)) return;
      const points =
        pointsRequired(annotation.tool) === 'many'
          ? simplifyStroke(annotation.points)
          : annotation.points;
      onChange([...annotations, { ...annotation, points }]);
    },
    [annotations, onChange],
  );

  /**
   * Remove whatever mark is under the pointer.
   *
   * This is an OBJECT eraser: it deletes a whole annotation rather than rubbing pixels
   * out of one. Annotations are stored as shapes, so erasing part of a stroke would mean
   * splitting it in two — and a supervisor reviewing the marking would then see something
   * the checker never actually drew.
   */
  const eraseAt = (point: AnnotationPoint, pointerType?: string): void => {
    if (!onChange) return;
    const pixel = toPixels(point, size);
    // A fingertip covers far more of the image than a cursor tip, so it needs a wider
    // reach or the checker taps a mark and nothing happens. A stylus is precise, so it
    // keeps the mouse tolerance.
    const hit = hitTest(annotations, pixel, size, pointerType === 'touch' ? TOUCH_TOLERANCE : 8);
    if (hit) onChange(annotations.filter((annotation) => annotation.id !== hit.id));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    // `readOnly` already covers `tool === 'none'`, and narrows it away for the rest.
    if (readOnly) return;
    // Ignore a second finger: a pinch must not start a stray stroke halfway through one.
    // Only an explicit `false` counts — some environments omit the flag entirely, and
    // treating "missing" as secondary would refuse every ordinary click.
    if (event.isPrimary === false) return;
    const point = pointFrom(event);

    if (tool === 'eraser') {
      // Capture the pointer so a drag keeps erasing even if it leaves the element.
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setErasing(true);
      eraseAt(point, event.pointerType);
      return;
    }

    // A note asks for its text up front: an empty pin on the page means nothing.
    if (tool === 'note') {
      const text = onRequestNoteText?.() ?? null;
      if (text === null || text.trim().length === 0) return;
      commit({
        id: nextAnnotationId(),
        tool,
        points: [point],
        color,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      });
      return;
    }

    // Stamps land immediately; everything else needs a drag.
    if (!isDragTool(tool)) {
      commit({
        id: nextAnnotationId(),
        tool,
        points: [point],
        color,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraft({
      id: nextAnnotationId(),
      tool,
      points: [point, point],
      color,
      createdAt: new Date().toISOString(),
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.isPrimary === false) return;
    // Dragging the eraser sweeps away everything it passes over.
    if (erasing) {
      eraseAt(pointFrom(event), event.pointerType);
      return;
    }
    if (!draft) return;
    const point = pointFrom(event);
    setDraft((current) => {
      if (!current) return current;
      // Freehand grows; a two-point shape only moves its far end.
      const points =
        pointsRequired(current.tool) === 'many'
          ? [...current.points, point]
          : [current.points[0]!, point];
      return { ...current, points };
    });
  };

  const handlePointerUp = (): void => {
    if (erasing) setErasing(false);
    if (!draft) return;
    commit(draft);
    setDraft(null);
  };

  return (
    <div
      ref={surfaceRef}
      className={cn(
        'relative select-none overflow-hidden rounded-lg border border-border bg-card',
        /**
         * `touch-none` is what makes drawing work on a touch screen at all. Without it
         * the browser claims a drag as a scroll gesture and the page moves instead of the
         * pen — pointer events still fire, but only the first one, so a stroke never
         * forms. It applies ONLY while a tool is in hand: with the select tool the surface
         * scrolls normally, which is how a checker moves the page on a phone.
         */
        readOnly ? 'touch-auto' : 'touch-none',
        !readOnly && (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'),
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <img src={imageUrl} alt={imageAlt} className="pointer-events-none block w-full" />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        width={size.width}
        height={size.height}
        aria-hidden
        data-testid="annotation-layer"
      >
        {annotations.map((annotation) => (
          <AnnotationShape key={annotation.id} annotation={annotation} size={size} />
        ))}
        {draft && <AnnotationShape annotation={draft} size={size} />}
      </svg>
    </div>
  );
}

export default AnnotationCanvas;
