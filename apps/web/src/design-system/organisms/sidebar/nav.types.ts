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
  module?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}
