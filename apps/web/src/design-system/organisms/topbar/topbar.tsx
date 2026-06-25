import { type ReactElement, type RefObject } from 'react';

import { Menu } from '@/design-system/atoms/icon';
import { ThemeToggle } from '@/design-system/atoms/theme-toggle';
import { UserMenu } from '@/design-system/molecules/user-menu';

export interface TopbarProps {
  /** Signed-in user (name + email) shown on the right; null renders a guest. */
  user: { fullName: string; email: string } | null;
  /** Whether the mobile drawer is open (for the hamburger's aria-expanded). */
  drawerOpen: boolean;
  /** Open the mobile drawer. */
  onOpenMenu: () => void;
  /** Log the user out. */
  onLogout: () => void;
  /** Ref to the hamburger button — focus is restored here when the drawer closes. */
  menuButtonRef?: RefObject<HTMLButtonElement>;
}

/** Top bar: mobile menu trigger, search placeholder, theme toggle and user menu. */
export function Topbar({
  user,
  drawerOpen,
  onOpenMenu,
  onLogout,
  menuButtonRef,
}: TopbarProps): ReactElement {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-sm sm:px-6">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:hidden"
      >
        <Menu size={20} aria-hidden />
      </button>

      <div className="hidden h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground md:flex">
        <span className="h-4 w-4 rounded bg-muted" />
        Search…
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <UserMenu name={user?.fullName} email={user?.email} onLogout={onLogout} />
      </div>
    </header>
  );
}

export default Topbar;
