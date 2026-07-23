/**
 * Router — one role layout per role (ADMIN / CONTROLLER / EVALUATOR / INSTITUTE),
 * each behind ProtectedRoute + RoleRoute.
 *
 * The module routes themselves live in ./modules, one file per module, each exporting
 * a factory that takes the hosting role's home path plus its slice of ROUTES. Modules
 * that more than one role exposes (exams: admin + controller; students: admin +
 * institute; e-sheet: admin + controller) are therefore declared ONCE and composed
 * per role, so a module change can't be applied to one role and missed on another.
 *
 * This file stays limited to the role shells: which modules each role gets, plus the
 * auth/public routes and the 404s. Route components are lazy-loaded (code splitting);
 * paths come from ./routes so the nav config and the routes can't drift.
 */
import React, { lazy } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { UserRole } from '@oses/types';

import { ModulePlaceholder, NotFoundPanel } from '@/components/widgets';
import { ROLE_CONFIG } from '@/config/roles.config';
import { useAuth } from '@/hooks';

import { checkerApprovalRoutes, checkerRoutes } from './modules/checkers.routes';
import { eSheetRoutes } from './modules/e-sheet.routes';
import { evaluatorRoutes } from './modules/evaluator.routes';
import { examRoutes } from './modules/exams.routes';
import { instituteExamRoutes } from './modules/institute-exams.routes';
import { instituteRoutes } from './modules/institutes.routes';
import { platformRoutes } from './modules/platform.routes';
import { rel } from './modules/rel';
import { setupRoutes } from './modules/setup.routes';
import { studentRoutes } from './modules/students.routes';
import { ProtectedRoute } from './protected-route';
import { RoleRoute } from './role-route';
import { ROUTES } from './routes';

const LoginPage = lazy(() => import('@/pages/auth/login.page'));
const RoleLayout = lazy(() => import('@/layout/role-layout'));
const AdminHome = lazy(() => import('@/pages/dashboards/admin-home'));
const ControllerHome = lazy(() => import('@/pages/dashboards/controller-home'));
const EvaluatorHome = lazy(() => import('@/pages/dashboards/evaluator-home'));
const InstituteHome = lazy(() => import('@/pages/dashboards/institute-home'));
const InstituteRegistrationPage = lazy(() => import('@/pages/public/institute-registration.page'));

/** Redirect to the current user's role landing page. */
function RoleHome(): React.ReactElement {
  const { user } = useAuth();
  const config = user ? ROLE_CONFIG[user.role] : undefined;
  if (!config) {
    return <Navigate to={ROUTES.login} replace />;
  }
  return <Navigate to={config.home} replace />;
}

function UnauthorizedPage(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-3xl font-bold text-danger-foreground">403 — Forbidden</h1>
      <p className="text-muted-foreground">You do not have permission to view this page.</p>
      <Link to="/" className="text-brand underline">
        Return to home
      </Link>
    </div>
  );
}

function NotFoundPage(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-3xl font-bold text-foreground">404 — Page Not Found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <Link to="/" className="text-brand underline">
        Return to home
      </Link>
    </div>
  );
}

export function RouterConfig(): React.ReactElement {
  const admin = ROUTES.admin;
  const controller = ROUTES.controller;
  const evaluator = ROUTES.evaluator;
  const institute = ROUTES.institute;

  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.registerInstitute} element={<InstituteRegistrationPage />} />
      <Route path={ROUTES.unauthorized} element={<UnauthorizedPage />} />

      <Route element={<ProtectedRoute />}>
        <Route index element={<RoleHome />} />

        {/* ADMIN — all modules */}
        <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
          <Route path={admin.home} element={<RoleLayout />}>
            <Route index element={<AdminHome />} />
            {checkerRoutes(admin.home, admin)}
            {checkerApprovalRoutes(admin.home, admin.checkerApprovals)}
            {eSheetRoutes(admin.home, admin)}
            {examRoutes(admin.home, admin)}
            {instituteRoutes(admin.home, admin)}
            {platformRoutes(admin.home, admin)}
            {setupRoutes(admin.home, admin)}
            {studentRoutes(admin.home, admin)}
            <Route
              path={rel(admin.home, admin.questions)}
              element={<ModulePlaceholder title="Question Assignments" />}
            />
            <Route
              path={rel(admin.home, admin.results)}
              element={<ModulePlaceholder title="Results" />}
            />
            <Route path="*" element={<NotFoundPanel />} />
          </Route>
        </Route>

        {/* CONTROLLER — examiner */}
        <Route element={<RoleRoute allowedRoles={[UserRole.CONTROLLER]} />}>
          <Route path={controller.home} element={<RoleLayout />}>
            <Route index element={<ControllerHome />} />
            {eSheetRoutes(controller.home, controller)}
            {examRoutes(controller.home, controller)}
            <Route
              path={rel(controller.home, controller.questions)}
              element={<ModulePlaceholder title="Questions Assignment" />}
            />
            <Route
              path={rel(controller.home, controller.resultCompilation)}
              element={<ModulePlaceholder title="Result Compilation" />}
            />
            <Route path="*" element={<NotFoundPanel />} />
          </Route>
        </Route>

        {/* EVALUATOR — checker */}
        <Route element={<RoleRoute allowedRoles={[UserRole.EVALUATOR]} />}>
          <Route path={evaluator.home} element={<RoleLayout />}>
            <Route index element={<EvaluatorHome />} />
            {evaluatorRoutes(evaluator.home, evaluator)}
            <Route path="*" element={<NotFoundPanel />} />
          </Route>
        </Route>

        {/* INSTITUTE — institute */}
        <Route element={<RoleRoute allowedRoles={[UserRole.INSTITUTE]} />}>
          <Route path={institute.home} element={<RoleLayout />}>
            <Route index element={<InstituteHome />} />
            {checkerRoutes(institute.home, institute)}
            {studentRoutes(institute.home, institute)}
            {instituteExamRoutes(institute.home, institute)}
            <Route
              path={rel(institute.home, institute.results)}
              element={<ModulePlaceholder title="Results" />}
            />
            <Route
              path={rel(institute.home, institute.profile)}
              element={<ModulePlaceholder title="Profile" />}
            />
            <Route path="*" element={<NotFoundPanel />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default RouterConfig;
