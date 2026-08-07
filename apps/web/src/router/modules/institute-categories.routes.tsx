/**
 * Institute categories route — deliberately its own factory rather than part of
 * `setupRoutes`.
 *
 * The other three setup screens (subjects, SLOs, classes) are reference data an Admin holds no
 * grant for, so they stay behind the Super-Admin-only shell. Categories are different: an Admin
 * holds `institute-categories.view`, because a category is what an institute *is* and they
 * cannot work on institutes without seeing it. Splitting the route out is what lets one screen
 * leave that shell without taking the other three with it.
 *
 * The page itself withholds every editing control without `institute-categories.manage`, and the
 * API refuses the mutations regardless — this route only decides who may open it.
 */
import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

import { rel } from './rel';

const InstituteCategoriesPage = lazy(() => import('@/pages/setup/institute-categories.page'));

export function instituteCategoryRoutes(home: string, path: string): React.ReactElement[] {
  return [
    <Route
      key="institute-categories"
      path={rel(home, path)}
      element={<InstituteCategoriesPage />}
    />,
  ];
}
