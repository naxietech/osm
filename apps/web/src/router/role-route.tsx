import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import type { UserRole } from '@oses/types';

import { useAuth } from '@/hooks/use-auth';

export interface RoleRouteProps {
  allowedRoles: UserRole[];
}

export function RoleRoute({ allowedRoles }: RoleRouteProps): React.ReactElement {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export default RoleRoute;
