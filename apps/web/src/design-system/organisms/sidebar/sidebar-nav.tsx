import { type ReactElement } from 'react';

import { NavGroup } from './nav-group';
import { NavLeaf } from './nav-leaf';
import type { NavSection } from './nav.types';

export interface SidebarNavProps {
  sections: NavSection[];
  pathname: string;
}

/** Renders the nav sections: each item is a leaf link or a collapsible group. */
export function SidebarNav({ sections, pathname }: SidebarNavProps): ReactElement {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.label} className="mb-5">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.label}
          </p>
          <div className="flex flex-col gap-2">
            {section.items.map((item) =>
              item.children ? (
                <NavGroup key={item.label} item={item} pathname={pathname} />
              ) : (
                <NavLeaf
                  key={item.label}
                  label={item.label}
                  to={item.to ?? '#'}
                  active={item.to === pathname}
                  icon={item.icon}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default SidebarNav;
