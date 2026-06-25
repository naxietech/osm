/**
 * Router — one role layout per role (ADMIN / CONTROLLER / EVALUATOR / SCHOOL_STAFF),
 * each behind ProtectedRoute + RoleRoute, with nested module routes (scaffold).
 * Route components are lazy-loaded (code splitting); paths come from ./routes so
 * the nav config and the routes can't drift. Each role has an in-layout 404.
 */
import React, { lazy } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { UserRole } from '@oses/types';

import { ModulePlaceholder, NotFoundPanel } from '@/components/widgets';
import { ROLE_CONFIG } from '@/config/roles.config';
import { useAuth } from '@/hooks';

import { ProtectedRoute } from './protected-route';
import { RoleRoute } from './role-route';
import { ROUTES } from './routes';

const LoginPage = lazy(() => import('@/pages/auth/login.page'));
const RoleLayout = lazy(() => import('@/layout/role-layout'));
const AdminHome = lazy(() => import('@/pages/dashboards/admin-home'));
const ControllerHome = lazy(() => import('@/pages/dashboards/controller-home'));
const EvaluatorHome = lazy(() => import('@/pages/dashboards/evaluator-home'));
const SchoolHome = lazy(() => import('@/pages/dashboards/school-home'));
const SchoolsListPage = lazy(() => import('@/pages/schools/schools-list.page'));
const SchoolDetailPage = lazy(() => import('@/pages/schools/school-detail.page'));

/** Relative child segment of an absolute path under its role home (no drift). */
const rel = (home: string, full: string): string => full.slice(home.length + 1);

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
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.unauthorized} element={<UnauthorizedPage />} />

      <Route element={<ProtectedRoute />}>
        <Route index element={<RoleHome />} />

        {/* ADMIN — all modules */}
        <Route element={<RoleRoute allowedRoles={[UserRole.ADMIN]} />}>
          <Route path={ROUTES.admin.home} element={<RoleLayout />}>
            <Route index element={<AdminHome />} />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.eSheet)}
              element={<Navigate to={ROUTES.admin.eSheetTemplateView} replace />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.eSheetTemplateAdd)}
              element={<ModulePlaceholder title="E-Sheet · Add Template" />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.eSheetTemplateView)}
              element={<ModulePlaceholder title="E-Sheet · Templates" />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.eSheetGenerate)}
              element={<ModulePlaceholder title="Generate E-Sheets" />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.questions)}
              element={<ModulePlaceholder title="Question Assignments" />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.results)}
              element={<ModulePlaceholder title="Results" />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.schools)}
              element={<Navigate to={ROUTES.admin.schoolsView} replace />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.schoolsView)}
              element={<SchoolsListPage />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.schoolsAdd)}
              element={<SchoolDetailPage />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.schoolDetail)}
              element={<SchoolDetailPage />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.students)}
              element={<Navigate to={ROUTES.admin.studentsView} replace />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.studentsView)}
              element={<ModulePlaceholder title="Students · View" />}
            />
            <Route
              path={rel(ROUTES.admin.home, ROUTES.admin.studentsManage)}
              element={<ModulePlaceholder title="Students · Add / Delete" />}
            />
            <Route path="*" element={<NotFoundPanel />} />
          </Route>
        </Route>

        {/* CONTROLLER — examiner */}
        <Route element={<RoleRoute allowedRoles={[UserRole.CONTROLLER]} />}>
          <Route path={ROUTES.controller.home} element={<RoleLayout />}>
            <Route index element={<ControllerHome />} />
            <Route
              path={rel(ROUTES.controller.home, ROUTES.controller.eSheet)}
              element={<Navigate to={ROUTES.controller.eSheetTemplateView} replace />}
            />
            <Route
              path={rel(ROUTES.controller.home, ROUTES.controller.eSheetTemplateAdd)}
              element={<ModulePlaceholder title="E-Sheet · Add Template" />}
            />
            <Route
              path={rel(ROUTES.controller.home, ROUTES.controller.eSheetTemplateView)}
              element={<ModulePlaceholder title="E-Sheet · Templates" />}
            />
            <Route
              path={rel(ROUTES.controller.home, ROUTES.controller.eSheetGenerate)}
              element={<ModulePlaceholder title="Generate E-Sheets" />}
            />
            <Route
              path={rel(ROUTES.controller.home, ROUTES.controller.questions)}
              element={<ModulePlaceholder title="Questions Assignment" />}
            />
            <Route
              path={rel(ROUTES.controller.home, ROUTES.controller.resultCompilation)}
              element={<ModulePlaceholder title="Result Compilation" />}
            />
            <Route path="*" element={<NotFoundPanel />} />
          </Route>
        </Route>

        {/* EVALUATOR — checker */}
        <Route element={<RoleRoute allowedRoles={[UserRole.EVALUATOR]} />}>
          <Route path={ROUTES.evaluator.home} element={<RoleLayout />}>
            <Route index element={<EvaluatorHome />} />
            <Route
              path={rel(ROUTES.evaluator.home, ROUTES.evaluator.assignWork)}
              element={<ModulePlaceholder title="Assign Work" />}
            />
            <Route
              path={rel(ROUTES.evaluator.home, ROUTES.evaluator.history)}
              element={<ModulePlaceholder title="History" />}
            />
            <Route
              path={rel(ROUTES.evaluator.home, ROUTES.evaluator.profile)}
              element={<ModulePlaceholder title="Profile" />}
            />
            <Route path="*" element={<NotFoundPanel />} />
          </Route>
        </Route>

        {/* SCHOOL_STAFF — school */}
        <Route element={<RoleRoute allowedRoles={[UserRole.SCHOOL_STAFF]} />}>
          <Route path={ROUTES.school.home} element={<RoleLayout />}>
            <Route index element={<SchoolHome />} />
            <Route
              path={rel(ROUTES.school.home, ROUTES.school.students)}
              element={<Navigate to={ROUTES.school.studentsView} replace />}
            />
            <Route
              path={rel(ROUTES.school.home, ROUTES.school.studentsView)}
              element={<ModulePlaceholder title="Students · View" />}
            />
            <Route
              path={rel(ROUTES.school.home, ROUTES.school.studentsManage)}
              element={<ModulePlaceholder title="Students · Add / Delete" />}
            />
            <Route
              path={rel(ROUTES.school.home, ROUTES.school.results)}
              element={<ModulePlaceholder title="Results" />}
            />
            <Route
              path={rel(ROUTES.school.home, ROUTES.school.profile)}
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
