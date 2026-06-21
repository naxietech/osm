import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Spinner } from '@/design-system/atoms/spinner';
import { useAuth } from '@/hooks/use-auth';

// TODO: connect to Redux auth store in next phase
export function ProtectedRoute(): React.ReactElement {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
