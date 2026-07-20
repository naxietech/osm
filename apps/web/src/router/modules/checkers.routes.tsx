/**
 * Checkers module routes — shared by ADMIN and INSTITUTE, which expose the same list +
 * add surface under different prefixes. The approvals queue is super-admin only, so it
 * is declared separately (see `checkerApprovalRoutes`).
 */
import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

import { rel } from './rel';

const CheckersListPage = lazy(() => import('@/pages/checkers/checkers-list.page'));
const CheckerAddPage = lazy(() => import('@/pages/checkers/checker-add.page'));
const CheckerDetailPage = lazy(() => import('@/pages/checkers/checker-detail.page'));
const CheckerApprovalsPage = lazy(() => import('@/pages/checkers/checker-approvals.page'));

/** The checker paths a hosting role must declare in ROUTES. */
export interface CheckerRoutePaths {
  checkers: string;
  checkersView: string;
  checkersAdd: string;
  checkerDetail: string;
}

export function checkerRoutes(home: string, paths: CheckerRoutePaths): React.ReactElement[] {
  return [
    <Route
      key="checkers"
      path={rel(home, paths.checkers)}
      element={<Navigate to={paths.checkersView} replace />}
    />,
    <Route
      key="checkers-view"
      path={rel(home, paths.checkersView)}
      element={<CheckersListPage />}
    />,
    <Route key="checkers-add" path={rel(home, paths.checkersAdd)} element={<CheckerAddPage />} />,
    // The static /add and /approvals paths outrank this dynamic segment (React Router
    // ranks by specificity, not declaration order), so it can sit last safely.
    <Route
      key="checker-detail"
      path={rel(home, paths.checkerDetail)}
      element={<CheckerDetailPage />}
    />,
  ];
}

/** Approving checkers is the super admin's alone. */
export function checkerApprovalRoutes(home: string, approvalsPath: string): React.ReactElement[] {
  return [
    <Route
      key="checker-approvals"
      path={rel(home, approvalsPath)}
      element={<CheckerApprovalsPage />}
    />,
  ];
}
