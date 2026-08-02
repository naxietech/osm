import { type ReactElement } from 'react';

import { KeyRound, LogOut } from '@/design-system/atoms/icon';
import { IconButton } from '@/design-system/atoms/icon-button';
import { getInitials } from '@/lib/utils';

export interface UserMenuProps {
  /** Display name; falls back to a guest label when absent. */
  name?: string;
  email?: string;
  onLogout: () => void;
  /** Omit to hide the change-password action. */
  onChangePassword?: () => void;
}

/** Avatar + identity + account actions. Presentational — every action is a callback. */
export function UserMenu({ name, email, onLogout, onChangePassword }: UserMenuProps): ReactElement {
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
      {onChangePassword && (
        <IconButton
          icon={<KeyRound size={16} aria-hidden />}
          label="Change password"
          onClick={onChangePassword}
        />
      )}
      <IconButton icon={<LogOut size={16} aria-hidden />} label="Log out" onClick={onLogout} />
    </div>
  );
}

export default UserMenu;
