/**
 * Setup / reference-data module routes (ADMIN) — the academic and institute
 * reference data every other module points at: categories, subjects, SLOs, classes.
 */
import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

import { rel } from './rel';

const InstituteCategoriesPage = lazy(() => import('@/pages/setup/institute-categories.page'));
const SubjectsPage = lazy(() => import('@/pages/setup/subjects.page'));
const SloPage = lazy(() => import('@/pages/setup/slo.page'));
const ClassesPage = lazy(() => import('@/pages/setup/classes.page'));

/** The setup paths a hosting role must declare in ROUTES. */
export interface SetupRoutePaths {
  instituteCategories: string;
  subjects: string;
  slos: string;
  classes: string;
}

export function setupRoutes(home: string, paths: SetupRoutePaths): React.ReactElement[] {
  return [
    <Route
      key="institute-categories"
      path={rel(home, paths.instituteCategories)}
      element={<InstituteCategoriesPage />}
    />,
    <Route key="subjects" path={rel(home, paths.subjects)} element={<SubjectsPage />} />,
    <Route key="slos" path={rel(home, paths.slos)} element={<SloPage />} />,
    <Route key="classes" path={rel(home, paths.classes)} element={<ClassesPage />} />,
  ];
}
