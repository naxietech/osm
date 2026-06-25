import { useCallback, useEffect, useState } from 'react';

export interface DrawerControls {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

/**
 * Mobile drawer open/close state with the usual dismissals: it closes on route
 * change (pass the current pathname), on Escape, and when the viewport grows past
 * the desktop breakpoint.
 */
export function useDrawer(pathname: string): DrawerControls {
  const [open, setOpen] = useState(false);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);

  // Close when the route changes (e.g. after tapping a nav item).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset when crossing to the desktop breakpoint.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (): void => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return { open, openDrawer, closeDrawer };
}
