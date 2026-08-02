import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Button } from '@/design-system/atoms/button';
import { Spinner } from '@/design-system/atoms/spinner';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';

/**
 * Gate for every signed-in route. Three states have to stay distinct:
 *
 *   loading — we do not know yet, so wait. On a page refresh the session is only known
 *     once `GET /auth/me` answers; treating "not known yet" as "not signed in" would
 *     throw a signed-in user out on every reload. Holding the render until the grants
 *     arrive matters too — a page painting while `can()` still answers false for
 *     everything is what would flash candidate PII in front of an evaluator.
 *
 *   couldn't ask — the server is down, we're offline, the response was unreadable. This
 *     is NOT "signed out": redirecting would silently boot every open tab to the login
 *     page during an outage, indistinguishable from a real expiry. Offer a retry instead.
 *
 *   signed out — a clean 401. Go to the login page.
 */
export function ProtectedRoute(): React.ReactElement {
  const { isAuthenticated, isLoading, sessionError, retrySession } = useAuth();
  const {
    isLoading: permissionsLoading,
    isError: permissionsError,
    retryPermissions,
  } = usePermissions();
  const location = useLocation();

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (sessionError || permissionsError) {
    return (
      <div
        role="alert"
        className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
      >
        <h1 className="text-xl font-semibold">We couldn&apos;t reach the server</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {sessionError
            ? 'Your session could not be confirmed. You have not been signed out.'
            : 'Your permissions could not be loaded, so the page is not safe to show yet.'}
        </p>
        <Button
          variant="primary"
          onClick={() => {
            if (sessionError) retrySession();
            if (permissionsError) retryPermissions();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
