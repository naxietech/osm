/**
 * Institute-side exams routes (INSTITUTE) — a distinct surface from the admin /
 * controller exam module: an institute browses the exams open to it and registers
 * its own candidates, rather than creating or editing exams.
 */
import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

import { rel } from './rel';

const InstituteExamsPage = lazy(() => import('@/pages/exams/institute-exams.page'));
const ExamRegisterPage = lazy(() => import('@/pages/exams/exam-register.page'));

/** The institute exam paths a hosting role must declare in ROUTES. */
export interface InstituteExamRoutePaths {
  exams: string;
  examsView: string;
  examRegister: string;
}

export function instituteExamRoutes(
  home: string,
  paths: InstituteExamRoutePaths,
): React.ReactElement[] {
  return [
    <Route
      key="exams"
      path={rel(home, paths.exams)}
      element={<Navigate to={paths.examsView} replace />}
    />,
    <Route key="exams-view" path={rel(home, paths.examsView)} element={<InstituteExamsPage />} />,
    <Route
      key="exam-register"
      path={rel(home, paths.examRegister)}
      element={<ExamRegisterPage />}
    />,
  ];
}
