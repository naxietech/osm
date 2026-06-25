import { type RefObject, useEffect } from 'react';

export interface FocusTrapOptions {
  /** When true, focus moves into the container and Tab is trapped inside it. */
  active: boolean;
  /** The element to trap focus within. */
  containerRef: RefObject<HTMLElement>;
  /** Optional element to restore focus to when the trap deactivates. */
  restoreRef?: RefObject<HTMLElement>;
}

/**
 * Traps Tab focus within `containerRef` while `active`. Focuses the first
 * focusable element on activate, cycles Tab/Shift+Tab at the edges, and restores
 * focus to `restoreRef` on deactivate.
 */
export function useFocusTrap({ active, containerRef, restoreRef }: FocusTrapOptions): void {
  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;
    const restore = restoreRef?.current ?? null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    getFocusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      restore?.focus();
    };
  }, [active, containerRef, restoreRef]);
}
