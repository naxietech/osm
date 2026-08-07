/**
 * Institutes module routes (ADMIN) — the institute register, the approval queue fed by the
 * public self-registration link, and the two screens for one institute: a read-only detail
 * view, and the add/edit form.
 *
 * Detail and form are separate pages because they are separate jobs. Reviewing an application
 * out of editable input boxes, with Save beside Approve, was the thing to fix.
 */
import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

import { rel } from './rel';

const InstitutesListPage = lazy(() => import('@/pages/institutes/institutes-list.page'));
const InstituteDetailPage = lazy(() => import('@/pages/institutes/institute-detail.page'));
const InstituteFormPage = lazy(() => import('@/pages/institutes/institute-form.page'));
const InstituteApprovalsPage = lazy(() => import('@/pages/institutes/institute-approvals.page'));

/** The institute paths a hosting role must declare in ROUTES. */
export interface InstituteRoutePaths {
  institutes: string;
  institutesView: string;
  institutesAdd: string;
  instituteApprovals: string;
  instituteDetail: string;
  instituteEdit: string;
}

export function instituteRoutes(home: string, paths: InstituteRoutePaths): React.ReactElement[] {
  return [
    <Route
      key="institutes"
      path={rel(home, paths.institutes)}
      element={<Navigate to={paths.institutesView} replace />}
    />,
    <Route
      key="institutes-view"
      path={rel(home, paths.institutesView)}
      element={<InstitutesListPage />}
    />,
    <Route
      key="institutes-add"
      path={rel(home, paths.institutesAdd)}
      element={<InstituteFormPage />}
    />,
    <Route
      key="institute-approvals"
      path={rel(home, paths.instituteApprovals)}
      element={<InstituteApprovalsPage />}
    />,
    // Before the `:id` route, or `/institutes/:id` would match `/institutes/abc/edit` first and
    // the edit screen would never be reachable.
    <Route
      key="institute-edit"
      path={rel(home, paths.instituteEdit)}
      element={<InstituteFormPage />}
    />,
    <Route
      key="institute-detail"
      path={rel(home, paths.instituteDetail)}
      element={<InstituteDetailPage />}
    />,
  ];
}
