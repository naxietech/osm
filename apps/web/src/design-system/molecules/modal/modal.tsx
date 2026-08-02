import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { X } from '@/design-system/atoms/icon';
import { useFocusTrap } from '@/lib/use-focus-trap';
import { cn } from '@/lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  /** Close request — backdrop click, the X, or Escape. Ignored while `busy`. */
  onClose: () => void;
  /** Heading text. Also names the dialog for assistive tech. */
  title: string;
  /** Optional line under the title, e.g. what the action will do. */
  description?: string;
  children?: ReactNode;
  /** Action buttons. Stacked full-width on mobile, right-aligned from `sm` up. */
  footer?: ReactNode;
  size?: ModalSize;
  /**
   * Work is in flight: dismissing is blocked so a half-finished request can't be
   * abandoned by a stray click, and the close button is hidden.
   */
  busy?: boolean;
  className?: string;
}

/**
 * Padding that clears the iPhone home indicator. Only matters below `sm`, where the panel
 * is a sheet pinned to the bottom edge; above that it is a floating card with its own gap.
 */
const SAFE_AREA_BOTTOM = 'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
};

/**
 * Accessible modal dialog, rendered through a portal so it escapes any parent's
 * `overflow` or stacking context.
 *
 * Layout is responsive by shape, not just width: on small screens it is a bottom sheet
 * pinned to the bottom edge (within thumb reach, and it never fights the on-screen
 * keyboard), and from `sm` up it becomes a centred card. Long content scrolls inside the
 * panel while the header and footer stay put, so the actions are always reachable.
 *
 * Accessibility: `role="dialog"` + `aria-modal`, labelled by the title and described by
 * the description; focus is trapped while open and returned to whatever opened it;
 * Escape closes; the page behind is locked from scrolling. The entrance animation is
 * disabled automatically by the global `prefers-reduced-motion` rule in base.css.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  busy = false,
  className,
}: ModalProps): React.ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Remember what had focus so the trap can hand it back on close — otherwise focus
  // falls to the top of the page and a keyboard user loses their place entirely.
  useEffect(() => {
    if (open) openerRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  useFocusTrap({ active: open, containerRef: panelRef, restoreRef: openerRef });

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  // Lock the page behind the dialog. Restoring the previous value rather than clearing
  // it keeps a second, nested lock from releasing the first one's.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="animate-overlay absolute inset-0 bg-black/50"
        onClick={() => !busy && onClose()}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'animate-modal relative flex max-h-[90dvh] w-full flex-col',
          'rounded-t-2xl border border-border bg-card shadow-xl',
          'sm:rounded-2xl',
          SIZE_CLASSES[size],
          className,
        )}
      >
        <div className="flex items-start gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {!busy && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className={cn(
                '-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>

        {children && (
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6',
              // Whichever section is last has to clear the home indicator, since the sheet
              // sits flush against the bottom edge on mobile.
              !footer && SAFE_AREA_BOTTOM,
            )}
          >
            {children}
          </div>
        )}

        {footer && (
          <div
            className={cn(
              'flex flex-col-reverse gap-2 border-t border-border px-5 py-4',
              'sm:flex-row sm:justify-end sm:px-6',
              SAFE_AREA_BOTTOM,
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
