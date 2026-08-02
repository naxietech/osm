import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import type { UserRole } from '@oses/types';

import { Spinner } from '@/design-system/atoms/spinner';
import { useAuth } from '@/hooks/use-auth';

export interface RoleRouteProps {
  allowedRoles: UserRole[];
}

export function RoleRoute({ allowedRoles }: RoleRouteProps): React.ReactElement {
  const { user, isLoading } = useAuth();

  // "We don't know yet" is not "signed out". Redirecting here would send a signed-in
  // user to the login page before `GET /auth/me` has answered — and because that is a
  // real navigation, the correct answer arriving a moment later cannot undo it.
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export default RoleRoute;
