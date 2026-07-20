/**
 * E-Sheet module routes — shared by ADMIN and CONTROLLER. Still placeholders; the
 * real template builder / generator land in Phase 4.
 */
import React from 'react';
import { Navigate, Route } from 'react-router-dom';

import { ModulePlaceholder } from '@/components/widgets';

import { rel } from './rel';

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
      element={<ModulePlaceholder title="E-Sheet · Add Template" />}
    />,
    <Route
      key="e-sheet-view"
      path={rel(home, paths.eSheetTemplateView)}
      element={<ModulePlaceholder title="E-Sheet · Templates" />}
    />,
    <Route
      key="e-sheet-generate"
      path={rel(home, paths.eSheetGenerate)}
      element={<ModulePlaceholder title="Generate E-Sheets" />}
    />,
  ];
}
