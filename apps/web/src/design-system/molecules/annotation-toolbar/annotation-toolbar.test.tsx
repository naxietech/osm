import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnnotationToolbar } from './annotation-toolbar';

function renderToolbar(
  overrides: Partial<React.ComponentProps<typeof AnnotationToolbar>> = {},
): React.ComponentProps<typeof AnnotationToolbar> {
  const props = {
    tool: 'pen' as const,
    onToolChange: vi.fn(),
    color: 'danger' as const,
    onColorChange: vi.fn(),
    onUndo: vi.fn(),
    onClear: vi.fn(),
    hasAnnotations: false,
    ...overrides,
  };
  render(<AnnotationToolbar {...props} />);
  return props;
}

describe('AnnotationToolbar', () => {
  it('offers the full toolset and marks the active one', () => {
    renderToolbar({ tool: 'highlighter' });
    for (const label of ['Pen', 'Highlighter', 'Rectangle', 'Eraser', 'Comment pin']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Highlighter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the tool and colour a checker picks', () => {
    const { onToolChange, onColorChange } = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    expect(onToolChange).toHaveBeenCalledWith('eraser');

    fireEvent.click(screen.getByRole('button', { name: 'Green' }));
    expect(onColorChange).toHaveBeenCalledWith('success');
  });

  it('disables undo and clear until something is drawn', () => {
    renderToolbar({ hasAnnotations: false });
    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
  });

  it('undo and clear fire once there are annotations', () => {
    const { onUndo, onClear } = renderToolbar({ hasAnnotations: true });
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
