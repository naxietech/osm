/**
 * RoleLayout — the app adapter for the shell. It wires auth + the role's nav
 * config to the presentational DashboardLayout (design system) and supplies the
 * router <Outlet/> as the page content. All the UI lives in the design system;
 * this file only connects it to app state.
 */
import { type ReactElement } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { DashboardLayout } from '@/design-system/templates/dashboard-layout';
import { useAuth } from '@/hooks';

import { ROLE_CONFIG } from './roles.config';

export function RoleLayout(): ReactElement {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navSections = (user && ROLE_CONFIG[user.role]?.nav) || [];

  return (
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
  );
}

export default RoleLayout;
