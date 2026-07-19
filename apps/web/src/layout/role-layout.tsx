/**
 * RoleLayout — the app adapter for the shell. It wires auth + the role's nav
 * config to the presentational DashboardLayout (design system) and supplies the
 * router <Outlet/> as the page content. All the UI lives in the design system;
 * this file only connects it to app state.
 */
import { type ReactElement } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { ROLE_CONFIG } from '@/config/roles.config';
import { DashboardLayout } from '@/design-system/templates/dashboard-layout';
import { useAuth, useClient } from '@/hooks';

import { ClientSwitcher } from './client-switcher';

export function RoleLayout(): ReactElement {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isModuleEnabled } = useClient();

  // Gate the role's nav by the active client's enabled modules (untagged items always show).
  const rawNav = (user && ROLE_CONFIG[user.role]?.nav) || [];
  const navSections = rawNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isModuleEnabled(item.module)),
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
