import type { ModuleKey, PermissionAction } from '@oses/types';

import type { LucideIcon } from '@/design-system/atoms/icon';

/**
 * Navigation data the sidebar renders. The shape lives in the design system (it's
 * the presentational contract); the app supplies the actual items (e.g. per-role).
 */
export interface NavItem {
  label: string;
  /** Route to navigate to; omit when the item only groups a submenu. */
  to?: string;
  /** Leading icon for top-level items (sub-menu children render without one). */
  icon?: LucideIcon;
  /** Submenu items (e.g. Students → View / Add-Delete). */
  children?: NavItem[];
  /** Opaque module key for multi-client gating; when set, the item shows only if the
   * active client enables that module. Untagged items always show. */
  module?: ModuleKey;
  /**
   * Grant required to see this item. Absent means everyone with the role sees it.
   *
   * A capability, not a role: an Admin holds `institutes.view` but not `institutes.manage`, so
   * "Institutes → Add" must disappear for them while "View" stays. Gating the whole group by
   * role could not express that, and leaving the link in place only leads to a 403 on a screen
   * they were invited to open.
   */
  requires?: PermissionAction;
  /** Optional count pill (e.g. pending approvals). Hidden when absent or 0. */
  badge?: number;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}
