/**
 * Institutes module routes (ADMIN) — the institute register, the "add institute"
 * form, and the approval queue fed by the public self-registration link.
 */
import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

import { rel } from './rel';

const InstitutesListPage = lazy(() => import('@/pages/institutes/institutes-list.page'));
const InstituteDetailPage = lazy(() => import('@/pages/institutes/institute-detail.page'));
const InstituteApprovalsPage = lazy(() => import('@/pages/institutes/institute-approvals.page'));

/** The institute paths a hosting role must declare in ROUTES. */
export interface InstituteRoutePaths {
  institutes: string;
  institutesView: string;
  institutesAdd: string;
  instituteApprovals: string;
  instituteDetail: string;
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
      element={<InstituteDetailPage />}
    />,
    <Route
      key="institute-approvals"
      path={rel(home, paths.instituteApprovals)}
      element={<InstituteApprovalsPage />}
    />,
    <Route
      key="institute-detail"
      path={rel(home, paths.instituteDetail)}
      element={<InstituteDetailPage />}
    />,
  ];
}
