/**
 * E-Sheet module routes — shared by ADMIN and CONTROLLER. Template creation and the
 * template list are built; generation still lands in a later phase.
 */
import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

import { ModulePlaceholder } from '@/components/widgets';

import { rel } from './rel';

const TemplateAddPage = lazy(() => import('@/pages/e-sheet/template-add.page'));
const TemplatesListPage = lazy(() => import('@/pages/e-sheet/templates-list.page'));

/** The e-sheet paths a hosting role must declare in ROUTES. */
export interface ESheetRoutePaths {
  eSheet: string;
  eSheetTemplateAdd: string;
  eSheetTemplateView: string;
  eSheetGenerate: string;
}

export function eSheetRoutes(home: string, paths: ESheetRoutePaths): React.ReactElement[] {
  return [
    <Route
      key="e-sheet"
      path={rel(home, paths.eSheet)}
      element={<Navigate to={paths.eSheetTemplateView} replace />}
    />,
    <Route
      key="e-sheet-add"
      path={rel(home, paths.eSheetTemplateAdd)}
      element={<TemplateAddPage />}
    />,
    <Route
      key="e-sheet-view"
      path={rel(home, paths.eSheetTemplateView)}
      element={<TemplatesListPage />}
    />,
    <Route
      key="e-sheet-generate"
      path={rel(home, paths.eSheetGenerate)}
      element={<ModulePlaceholder title="Generate E-Sheets" />}
    />,
  ];
}
