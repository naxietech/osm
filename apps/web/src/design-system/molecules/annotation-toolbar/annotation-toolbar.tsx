import React from 'react';

import { type AnnotationColor } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import {
  ArrowUpRight,
  Check,
  Circle,
  Eraser,
  Highlighter,
  type LucideIcon,
  MessageSquare,
  MousePointer2,
  Pencil,
  Square,
  Trash2,
  Undo2,
  X,
} from '@/design-system/atoms/icon';
import { type AnnotationCanvasTool } from '@/design-system/molecules/annotation-canvas';
import { cn } from '@/lib/utils';

interface ToolDef {
  tool: AnnotationCanvasTool;
  label: string;
  icon: LucideIcon;
}

const TOOLS: ToolDef[] = [
  { tool: 'none', label: 'Select (no drawing)', icon: MousePointer2 },
  { tool: 'pen', label: 'Pen', icon: Pencil },
  { tool: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { tool: 'rectangle', label: 'Rectangle', icon: Square },
  { tool: 'ellipse', label: 'Ellipse', icon: Circle },
  { tool: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { tool: 'tick', label: 'Tick', icon: Check },
  { tool: 'cross', label: 'Cross', icon: X },
  { tool: 'note', label: 'Comment pin', icon: MessageSquare },
  // Removes a whole mark, not part of one — see AnnotationCanvas for why.
  { tool: 'eraser', label: 'Eraser', icon: Eraser },
];

const COLORS: { color: AnnotationColor; label: string; swatch: string }[] = [
  { color: 'danger', label: 'Red', swatch: 'bg-danger' },
  { color: 'success', label: 'Green', swatch: 'bg-success' },
  { color: 'warning', label: 'Amber', swatch: 'bg-warning' },
  { color: 'brand', label: 'Accent', swatch: 'bg-brand' },
];

export interface AnnotationToolbarProps {
  tool: AnnotationCanvasTool;
  onToolChange: (tool: AnnotationCanvasTool) => void;
  color: AnnotationColor;
  onColorChange: (color: AnnotationColor) => void;
  onUndo: () => void;
  onClear: () => void;
  /** Whether there is anything to undo or clear. */
  hasAnnotations: boolean;
  className?: string;
}

/**
 * The drawing controls for the annotation canvas: tool palette, ink colour and
 * undo / clear. Presentational — it reports the chosen tool and colour and leaves the
 * annotation state to the caller.
 *
 * One horizontally scrollable strip rather than a wrapping block: on a phone the ten
 * tools plus colours would otherwise wrap to three rows and push the answer off the
 * screen. Targets are 44px — the smallest a fingertip can hit reliably — shrinking to
 * 36px only from `sm` up, where a mouse is likely.
 */
export function AnnotationToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  onUndo,
  onClear,
  hasAnnotations,
  className,
}: AnnotationToolbarProps): React.ReactElement {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border bg-card', className)}>
      <div className="flex w-max min-w-full items-center gap-2 p-2 sm:w-auto">
        <div className="flex items-center gap-1" role="group" aria-label="Drawing tools">
          {TOOLS.map((item) => {
            const Icon = item.icon;
            const active = tool === item.tool;
            return (
              <button
                key={item.tool}
                type="button"
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => onToolChange(item.tool)}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors sm:h-9 sm:w-9',
                  active
                    ? 'border-brand bg-brand-subtle text-brand'
                    : 'border-transparent text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden />
              </button>
            );
          })}
        </div>

        <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />

        <div className="flex items-center gap-1" role="group" aria-label="Ink colour">
          {COLORS.map((item) => (
            <button
              key={item.color}
              type="button"
              aria-label={item.label}
              aria-pressed={color === item.color}
              onClick={() => onColorChange(item.color)}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-md sm:h-9 sm:w-9',
                color === item.color ? 'bg-muted' : '',
              )}
            >
              {/* The swatch is the visual; the button around it is the touch target. */}
              <span
                className={cn(
                  'block h-6 w-6 rounded-full border-2 transition-transform',
                  item.swatch,
                  color === item.color ? 'scale-110 border-foreground' : 'border-transparent',
                )}
              />
            </button>
          ))}
        </div>

        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" disabled={!hasAnnotations} onClick={onUndo}>
            <Undo2 className="h-4 w-4" aria-hidden />
            Undo
          </Button>
          <Button variant="ghost" size="sm" disabled={!hasAnnotations} onClick={onClear}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Clear
          </Button>
        </span>
      </div>
    </div>
  );
}

export default AnnotationToolbar;
