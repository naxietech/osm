/**
 * RoleLayout — the app adapter for the shell. It wires auth + the role's nav
 * config to the presentational DashboardLayout (design system) and supplies the
 * router <Outlet/> as the page content. All the UI lives in the design system;
 * this file only connects it to app state.
 */
import { type ReactElement } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { ROLE_CONFIG } from '@/config/roles.config';
import { type NavItem } from '@/design-system/organisms/sidebar';
import { DashboardLayout } from '@/design-system/templates/dashboard-layout';
import { useAuth, useClient } from '@/hooks';
import { ROUTES } from '@/router/routes';
import { countPendingInstitutes } from '@/services/institute.service';

import { ClientSwitcher } from './client-switcher';

/** Stamp a live count onto the Approvals leaf (and bubble it to its parent group). */
function withApprovalsBadge(item: NavItem, pending: number): NavItem {
  if (item.to === ROUTES.admin.instituteApprovals) return { ...item, badge: pending };
  if (item.children) {
    const children = item.children.map((child) => withApprovalsBadge(child, pending));
    const badge = children.reduce((sum, c) => sum + (c.badge ?? 0), 0);
    return { ...item, children, ...(badge > 0 ? { badge } : {}) };
  }
  return item;
}

export function RoleLayout(): ReactElement {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isModuleEnabled } = useClient();

  const pending = countPendingInstitutes();

  // Gate the role's nav by the active client's enabled modules (untagged items always show).
  const rawNav = (user && ROLE_CONFIG[user.role]?.nav) || [];
  const navSections = rawNav
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => isModuleEnabled(item.module))
        .map((item) => withApprovalsBadge(item, pending)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <DashboardLayout
        navSections={navSections}
        user={user ? { fullName: user.fullName, email: user.email } : null}
        onLogout={() => {
          logout();
          void navigate('/login');
        }}
      >
        <Outlet />
      </DashboardLayout>
      <ClientSwitcher />
    </>
  );
}

export default RoleLayout;
