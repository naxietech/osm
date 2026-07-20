import { type ReactElement } from 'react';

export interface NavBadgeProps {
  /** Count to show; the badge renders only when this is greater than 0. */
  count?: number;
}

/** Small count pill shown on a nav item (e.g. pending approvals). Caps display at 99+. */
export function NavBadge({ count }: NavBadgeProps): ReactElement | null {
  if (!count || count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default NavBadge;
