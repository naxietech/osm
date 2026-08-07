import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { AlertTriangle, Check, Info, X } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

/**
 * How long a toast stays before it withdraws itself.
 *
 * Ten seconds, not five. Several of these carry the server's own wording — which institute was
 * approved, whether a login was created with it — and that is a sentence to read, not a tick to
 * glance at. The close button is there for anyone who has finished sooner.
 */
const DISMISS_AFTER_MS = 10_000;

const toneStyles: Record<ToastTone, { container: string; icon: React.ReactNode; role: string }> = {
  success: {
    container: 'border-success/40 bg-success-subtle text-success-foreground',
    icon: <Check className="h-4 w-4" aria-hidden />,
    role: 'status',
  },
  error: {
    container: 'border-danger/40 bg-danger-subtle text-danger-foreground',
    icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
    role: 'alert',
  },
  warning: {
    container: 'border-warning/40 bg-warning-subtle text-warning-foreground',
    icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
    role: 'alert',
  },
  info: {
    container: 'border-info/40 bg-info-subtle text-info-foreground',
    icon: <Info className="h-4 w-4" aria-hidden />,
    role: 'status',
  },
};

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  /** Remove one early — the close button, or a screen that has moved on. */
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * App-wide toasts: top-right, one component, ten seconds.
 *
 * Replaces the inline `<Alert>` banner each screen was pushing above its own content. Those
 * shifted the page down as they appeared, sat wherever the screen happened to put them, and had
 * to be dismissed by hand — so every screen re-implemented the same "did I remember to clear
 * this?" state. A toast is transient by definition, which is the right shape for "that worked".
 *
 * **What still belongs in an `Alert`, not here.** Anything the reader must be able to go back and
 * re-read, or act on: a validation summary, an optimistic-lock conflict explaining what to do
 * next, a duplicate warning beside the record it concerns. A message that takes itself away must
 * never be the only place something important was said.
 *
 * Mounted once, above the router — see `main.tsx`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Monotonic and never reused, so a fast pair of toasts cannot collide on a React key. A
  // timestamp would: two raised in the same millisecond are not unusual.
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number): void => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string): void => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS),
      );
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      warning: (message) => push('warning', message),
      info: (message) => push('info', message),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Raise a toast. Throws when used outside the provider rather than silently doing nothing — a
 * confirmation that never appears is the failure mode this is meant to prevent.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside a <ToastProvider>');
  return api;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}): React.ReactElement {
  return (
    <div
      // `aria-live` on the container, not the toast: a live region has to exist in the DOM
      // *before* the message arrives, or a screen reader has nothing to watch and announces
      // nothing. `pointer-events-none` so an empty viewport never swallows a click.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => {
        const style = toneStyles[toast.tone];
        return (
          <div
            key={toast.id}
            role={style.role}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
              'motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:fade-in',
              style.container,
            )}
          >
            <span className="mt-0.5 shrink-0">{style.icon}</span>
            <p className="flex-1 break-words">{toast.message}</p>
            <IconButton
              size="sm"
              label="Dismiss"
              className="-mr-1 -mt-1 border-0 bg-transparent"
              icon={<X className="h-4 w-4" aria-hidden />}
              onClick={() => onDismiss(toast.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

export default ToastProvider;
