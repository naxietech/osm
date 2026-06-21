import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';

import type { UserRole } from '@oses/types';

export interface RoleRouteProps {
  allowedRoles: UserRole[];
}

export function RoleRoute({ allowedRoles }: RoleRouteProps): React.ReactElement {
  const { user } = useAuth();

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export default RoleRoute;
