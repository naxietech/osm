import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type Annotation } from '@oses/types';

import { AnnotationCanvas } from './annotation-canvas';

/**
 * jsdom has no layout: every element measures 0×0 and pointer capture does not exist, so
 * the freehand DRAWING cannot be simulated faithfully here — that needs a manual
 * click-through. What these cover is everything around it: what gets rendered from stored
 * annotations, and which interactions are allowed to produce one at all. The coordinate
 * maths the drawing depends on is tested exactly in annotation-geometry.test.ts.
 */
const IMAGE = 'data:image/png;base64,placeholder';

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'ann_seed',
    tool: 'tick',
    points: [{ x: 0.5, y: 0.5 }],
    color: 'success',
    createdAt: '2026-07-21T10:00:00.000Z',
    ...overrides,
  };
}

type RenderCanvasResult = ReturnType<typeof render> & { onChange: ReturnType<typeof vi.fn> };

function renderCanvas(
  props: Partial<React.ComponentProps<typeof AnnotationCanvas>> = {},
): RenderCanvasResult {
  const onChange = vi.fn();
  const result = render(
    <AnnotationCanvas
      imageUrl={IMAGE}
      imageAlt="Answer to Q4"
      annotations={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return { ...result, onChange };
}

describe('AnnotationCanvas', () => {
  it('shows the answer image with a description that is not the candidate', () => {
    renderCanvas();
    const image = screen.getByAltText('Answer to Q4');
    expect(image).toHaveAttribute('src', IMAGE);
  });

  it('renders one shape per stored annotation', () => {
    const { container } = renderCanvas({
      annotations: [
        makeAnnotation({ id: 'a', tool: 'tick' }),
        makeAnnotation({ id: 'b', tool: 'cross', color: 'danger' }),
        makeAnnotation({
          id: 'c',
          tool: 'pen',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        }),
      ],
    });
    const layer = screen.getByTestId('annotation-layer');
    // tick = polyline, cross = g of two lines, pen = polyline
    expect(layer.querySelectorAll('polyline')).toHaveLength(2);
    expect(container.querySelectorAll('line')).toHaveLength(2);
  });

  it('colours an annotation from the theme, never a raw hex', () => {
    renderCanvas({ annotations: [makeAnnotation({ tool: 'pen', color: 'danger' })] });
    const shape = screen.getByTestId('annotation-layer').querySelector('polyline');
    expect(shape).toHaveAttribute('stroke', 'var(--color-danger)');
  });

  // The pin carries its text as an SVG <title>, which browsers show on hover. The overlay
  // is aria-hidden because it is a visual layer; the workspace lists notes as text for
  // anyone who cannot see them.
  it('carries a note’s text on the pin', () => {
    renderCanvas({
      annotations: [makeAnnotation({ tool: 'note', text: 'Units missing', color: 'warning' })],
    });
    const title = screen.getByTestId('annotation-layer').querySelector('title');
    expect(title?.textContent).toBe('Units missing');
  });

  it('draws nothing when there are no annotations', () => {
    renderCanvas();
    expect(screen.getByTestId('annotation-layer').children).toHaveLength(0);
  });

  // A stamp tool lands on a single click, so this one interaction IS testable.
  it('adds a stamp on click when a stamp tool is in hand', () => {
    const { container, onChange } = renderCanvas({ tool: 'tick', color: 'success' });
    fireEvent.pointerDown(container.firstChild as Element, { clientX: 10, clientY: 10 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [added] = onChange.mock.calls[0] as [Annotation[]];
    expect(added).toHaveLength(1);
    expect(added[0]?.tool).toBe('tick');
    expect(added[0]?.color).toBe('success');
    expect(added[0]?.points).toHaveLength(1);
  });

  it('appends to the existing annotations rather than replacing them', () => {
    const existing = [makeAnnotation({ id: 'first' })];
    const { container, onChange } = renderCanvas({ tool: 'cross', annotations: existing });
    fireEvent.pointerDown(container.firstChild as Element, { clientX: 10, clientY: 10 });

    const [added] = onChange.mock.calls[0] as [Annotation[]];
    expect(added).toHaveLength(2);
    expect(added[0]?.id).toBe('first');
  });

  it('gives every annotation its own id', () => {
    const { container, onChange } = renderCanvas({ tool: 'tick' });
    const surface = container.firstChild as Element;
    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 });
    fireEvent.pointerDown(surface, { clientX: 20, clientY: 20 });

    const first = (onChange.mock.calls[0] as [Annotation[]])[0][0]?.id;
    const second = (onChange.mock.calls[1] as [Annotation[]])[0][0]?.id;
    expect(first).not.toBe(second);
  });

  // Read-only is how a supervisor reviews a marked script without altering it.
  it('draws nothing when no tool is in hand', () => {
    const { container, onChange } = renderCanvas({ tool: 'none' });
    fireEvent.pointerDown(container.firstChild as Element, { clientX: 10, clientY: 10 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still renders existing annotations when read-only', () => {
    renderCanvas({ tool: 'none', annotations: [makeAnnotation({ tool: 'pen' })] });
    expect(screen.getByTestId('annotation-layer').children).toHaveLength(1);
  });

  /**
   * jsdom reports a 0×0 surface, so every annotation collapses onto the same point and the
   * eraser hits whatever is on top. That makes these cover the WIRING — that erasing
   * removes rather than adds, keeps the rest, and respects read-only. Whether it hits the
   * right mark by position is proved exactly in annotation-geometry.test.ts (`hitTest`).
   */
  describe('eraser', () => {
    const first = makeAnnotation({ id: 'first', tool: 'pen' });
    const second = makeAnnotation({ id: 'second', tool: 'cross' });

    it('removes the mark under the pointer and keeps the rest', () => {
      const { container, onChange } = renderCanvas({
        tool: 'eraser',
        annotations: [first, second],
      });
      fireEvent.pointerDown(container.firstChild as Element, { clientX: 0, clientY: 0 });

      expect(onChange).toHaveBeenCalledTimes(1);
      const [remaining] = onChange.mock.calls[0] as [Annotation[]];
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe('first');
    });

    // An eraser is a mode, not a mark — it must never end up stored as an annotation.
    it('never adds an annotation of its own', () => {
      const { container, onChange } = renderCanvas({ tool: 'eraser', annotations: [first] });
      fireEvent.pointerDown(container.firstChild as Element, { clientX: 0, clientY: 0 });

      const [remaining] = onChange.mock.calls[0] as [Annotation[]];
      expect(remaining.length).toBeLessThan(1 + 1);
      expect(remaining.some((a) => (a.tool as string) === 'eraser')).toBe(false);
    });

    it('does nothing when there is nothing to erase', () => {
      const { container, onChange } = renderCanvas({ tool: 'eraser', annotations: [] });
      fireEvent.pointerDown(container.firstChild as Element, { clientX: 0, clientY: 0 });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('erases nothing in read-only mode', () => {
      const { container, onChange } = renderCanvas({ tool: 'none', annotations: [first] });
      fireEvent.pointerDown(container.firstChild as Element, { clientX: 0, clientY: 0 });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  /**
   * Touch behaviour.
   *
   * jsdom cannot simulate a finger: it has no layout, and `isPrimary` is read-only on its
   * PointerEvent so a second-finger event cannot be faked. The multi-touch guard is
   * therefore NOT covered here — it needs a real device. What is covered is the one
   * property that decides whether drawing works on touch at all.
   */
  describe('touch', () => {
    // Without `touch-action: none` the browser claims a drag as a scroll: the page moves,
    // only the first pointer event arrives, and no stroke ever forms. This single class is
    // the difference between the pen working and doing nothing on a phone.
    it('stops the browser treating a drag as a scroll while a tool is in hand', () => {
      const { container } = renderCanvas({ tool: 'pen' });
      expect(container.firstChild).toHaveClass('touch-none');
    });

    // With no tool, the surface must scroll normally — that is how a checker moves the
    // page on a phone, since the answer image fills most of the screen.
    it('lets the page scroll again when no tool is in hand', () => {
      const { container } = renderCanvas({ tool: 'none' });
      expect(container.firstChild).toHaveClass('touch-auto');
      expect(container.firstChild).not.toHaveClass('touch-none');
    });
  });

  describe('notes', () => {
    it('asks for the text and pins it', () => {
      const onRequestNoteText = vi.fn(() => 'Show your working');
      const { container, onChange } = renderCanvas({ tool: 'note', onRequestNoteText });
      fireEvent.pointerDown(container.firstChild as Element, { clientX: 10, clientY: 10 });

      expect(onRequestNoteText).toHaveBeenCalled();
      const [added] = onChange.mock.calls[0] as [Annotation[]];
      expect(added[0]?.text).toBe('Show your working');
    });

    // An empty pin on the page tells a supervisor nothing, so it must not be created.
    it('creates nothing when the note is cancelled or left blank', () => {
      const { container, onChange, rerender } = renderCanvas({
        tool: 'note',
        onRequestNoteText: () => null,
      });
      fireEvent.pointerDown(container.firstChild as Element, { clientX: 10, clientY: 10 });
      expect(onChange).not.toHaveBeenCalled();

      rerender(
        <AnnotationCanvas
          imageUrl={IMAGE}
          imageAlt="Answer to Q4"
          annotations={[]}
          onChange={onChange}
          tool="note"
          onRequestNoteText={() => '   '}
        />,
      );
      fireEvent.pointerDown(container.firstChild as Element, { clientX: 10, clientY: 10 });
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
