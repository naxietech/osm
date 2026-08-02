/**
 * Platform module routes (ADMIN) — roles/permissions and the user accounts that
 * are assigned those roles. The super admin's RBAC management surface.
 */
import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

import { rel } from './rel';

const RolesListPage = lazy(() => import('@/pages/roles/roles-list.page'));
const RoleDetailPage = lazy(() => import('@/pages/roles/role-detail.page'));
const UsersListPage = lazy(() => import('@/pages/users/users-list.page'));
const UserDetailPage = lazy(() => import('@/pages/users/user-detail.page'));

/** The platform paths a hosting role must declare in ROUTES. */
export interface PlatformRoutePaths {
  roles: string;
  roleDetail: string;
  users: string;
  usersNew: string;
}

export function platformRoutes(home: string, paths: PlatformRoutePaths): React.ReactElement[] {
  return [
    <Route key="roles" path={rel(home, paths.roles)} element={<RolesListPage />} />,
    <Route key="role-detail" path={rel(home, paths.roleDetail)} element={<RoleDetailPage />} />,
    <Route key="users" path={rel(home, paths.users)} element={<UsersListPage />} />,
    <Route key="users-new" path={rel(home, paths.usersNew)} element={<UserDetailPage />} />,
  ];
}
