/**
 * REFERENCE PATTERN — Router
 * All routes use React.lazy for code splitting.
 * Protected routes require authentication (ProtectedRoute).
 * Role routes require a specific role (RoleRoute).
 * Add future module routes following the /admin/schools pattern.
 */
import React, { lazy } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { UserRole } from '@oses/types';

import { ProtectedRoute } from './protected-route';
import { RoleRoute } from './role-route';

const LoginPage = lazy(() => import('@/pages/auth/login.page'));
const SchoolsListPage = lazy(() => import('@/pages/admin/schools/schools-list.page'));
const SchoolDetailPage = lazy(() => import('@/pages/admin/schools/school-detail.page'));

function UnauthorizedPage(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-red-600">403 — Forbidden</h1>
      <p className="text-gray-600">You do not have permission to view this page.</p>
      <Link to="/" className="text-[#0E7490] underline">
        Return to home
      </Link>
    </div>
  );
}

function NotFoundPage(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-gray-800">404 — Page Not Found</h1>
      <p className="text-gray-600">The page you are looking for does not exist.</p>
      <Link to="/" className="text-[#0E7490] underline">
        Return to home
      </Link>
    </div>
  );
}

export function RouterConfig(): React.ReactElement {
  return (
    <Routes>
      <Route index element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route element={<ProtectedRoute />}>
        {/* Admin routes */}
        <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
          <Route path="/admin" element={<Navigate to="/admin/schools" replace />} />
          <Route path="/admin/schools" element={<SchoolsListPage />} />
          <Route path="/admin/schools/:id" element={<SchoolDetailPage />} />
        </Route>

        {/* Controller routes */}
        <Route element={<RoleRoute allowedRoles={[UserRole.CONTROLLER]} />}>
          <Route
            path="/controller"
            element={<div className="p-8">Controller Dashboard — coming soon</div>}
          />
        </Route>

        {/* Evaluator routes */}
        <Route element={<RoleRoute allowedRoles={[UserRole.EVALUATOR]} />}>
          <Route
            path="/evaluator"
            element={<div className="p-8">Evaluator Dashboard — coming soon</div>}
          />
        </Route>

        {/* School Staff routes */}
        <Route element={<RoleRoute allowedRoles={[UserRole.SCHOOL_STAFF]} />}>
          <Route
            path="/school"
            element={<div className="p-8">School Staff Dashboard — coming soon</div>}
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default RouterConfig;
