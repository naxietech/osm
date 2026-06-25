import { type ReactElement } from 'react';

import { LogOut } from '@/design-system/atoms/icon';
import { getInitials } from '@/lib/utils';

export interface UserMenuProps {
  /** Display name; falls back to a guest label when absent. */
  name?: string;
  email?: string;
  onLogout: () => void;
}

/** Avatar + identity + logout button. Presentational — logout is a callback. */
export function UserMenu({ name, email, onLogout }: UserMenuProps): ReactElement {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2 pl-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
          {name ? getInitials(name) : '?'}
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-medium text-foreground">{name ?? 'Guest'}</p>
          <p className="text-xs text-muted-foreground">{email ?? ''}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        title="Log out"
        aria-label="Log out"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <LogOut size={16} aria-hidden />
      </button>
    </div>
  );
}

export default UserMenu;
