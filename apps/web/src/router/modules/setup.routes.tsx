/**
 * Setup / reference-data module routes (SUPER ADMIN) — the academic reference data every other
 * module points at: subjects, SLOs, classes.
 *
 * Institute categories used to live here and now has its own factory, because an Admin may view
 * it and may not view these three. See `institute-categories.routes.tsx`.
 */
import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

import { rel } from './rel';

const SubjectsPage = lazy(() => import('@/pages/setup/subjects.page'));
const SloPage = lazy(() => import('@/pages/setup/slo.page'));
const ClassesPage = lazy(() => import('@/pages/setup/classes.page'));

/** The setup paths a hosting role must declare in ROUTES. */
export interface SetupRoutePaths {
  subjects: string;
  slos: string;
  classes: string;
}

export function setupRoutes(home: string, paths: SetupRoutePaths): React.ReactElement[] {
  return [
    <Route key="subjects" path={rel(home, paths.subjects)} element={<SubjectsPage />} />,
    <Route key="slos" path={rel(home, paths.slos)} element={<SloPage />} />,
    <Route key="classes" path={rel(home, paths.classes)} element={<ClassesPage />} />,
  ];
}
