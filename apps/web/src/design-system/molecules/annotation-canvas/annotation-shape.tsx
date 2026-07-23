import React from 'react';

import { type Annotation } from '@oses/types';

import {
  type CanvasSize,
  colorToken,
  opacityFor,
  strokeWidthFor,
  toBox,
  toPixels,
  toPolylinePoints,
} from './annotation-geometry';

/**
 * Renders one stored annotation as SVG. Pure — same annotation and size, same output.
 *
 * Domain-coupled to the canvas: it reads annotation tools and works in the canvas's pixel
 * space, so it lives inside this molecule rather than as a standalone atom.
 */
export function AnnotationShape({
  annotation,
  size,
}: {
  annotation: Annotation;
  size: CanvasSize;
}): React.ReactElement | null {
  const stroke = colorToken(annotation.color);
  const strokeWidth = strokeWidthFor(annotation.tool);
  const opacity = opacityFor(annotation.tool);
  const first = annotation.points[0];
  if (!first) return null;

  const common = {
    stroke,
    strokeWidth,
    opacity,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (annotation.tool) {
    case 'pen':
    case 'highlighter':
      return <polyline {...common} points={toPolylinePoints(annotation.points, size)} />;

    case 'rectangle': {
      const last = annotation.points[annotation.points.length - 1]!;
      const box = toBox(first, last, size);
      return <rect {...common} x={box.x} y={box.y} width={box.width} height={box.height} rx={2} />;
    }

    case 'ellipse': {
      const last = annotation.points[annotation.points.length - 1]!;
      const box = toBox(first, last, size);
      return (
        <ellipse
          {...common}
          cx={box.x + box.width / 2}
          cy={box.y + box.height / 2}
          rx={box.width / 2}
          ry={box.height / 2}
        />
      );
    }

    case 'arrow': {
      const last = annotation.points[annotation.points.length - 1]!;
      const from = toPixels(first, size);
      const to = toPixels(last, size);
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = 12;
      // Two short strokes swept back from the tip make the head, so it stays sharp at
      // any angle without needing an SVG marker definition.
      const left = {
        x: to.x - head * Math.cos(angle - Math.PI / 7),
        y: to.y - head * Math.sin(angle - Math.PI / 7),
      };
      const right = {
        x: to.x - head * Math.cos(angle + Math.PI / 7),
        y: to.y - head * Math.sin(angle + Math.PI / 7),
      };
      return (
        <g>
          <line {...common} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          <polyline
            {...common}
            points={`${left.x},${left.y} ${to.x},${to.y} ${right.x},${right.y}`}
          />
        </g>
      );
    }

    case 'tick': {
      const p = toPixels(first, size);
      return (
        <polyline
          {...common}
          strokeWidth={3}
          points={`${p.x - 8},${p.y} ${p.x - 2},${p.y + 7} ${p.x + 9},${p.y - 8}`}
        />
      );
    }

    case 'cross': {
      const p = toPixels(first, size);
      return (
        <g>
          <line {...common} strokeWidth={3} x1={p.x - 8} y1={p.y - 8} x2={p.x + 8} y2={p.y + 8} />
          <line {...common} strokeWidth={3} x1={p.x + 8} y1={p.y - 8} x2={p.x - 8} y2={p.y + 8} />
        </g>
      );
    }

    case 'note': {
      const p = toPixels(first, size);
      return (
        <g>
          <title>{annotation.text}</title>
          <circle cx={p.x} cy={p.y} r={9} fill={stroke} opacity={0.9} />
          <text
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight="700"
            fill="var(--color-card)"
          >
            !
          </text>
        </g>
      );
    }

    default:
      return null;
  }
}

export default AnnotationShape;
