/**
 * Exams module routes — shared by ADMIN and CONTROLLER, which expose an identical
 * exam surface under different path prefixes. Defined once here so a change to the
 * module reaches both roles.
 */
import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

import { rel } from './rel';

const ExamsListPage = lazy(() => import('@/pages/exams/exams-list.page'));
const ExamDetailPage = lazy(() => import('@/pages/exams/exam-detail.page'));
const ExamCandidatesPage = lazy(() => import('@/pages/exams/exam-candidates.page'));

/** The exam paths a hosting role must declare in ROUTES. */
export interface ExamRoutePaths {
  exams: string;
  examsView: string;
  examsCreate: string;
  examDetail: string;
  examCandidates: string;
}

export function examRoutes(home: string, paths: ExamRoutePaths): React.ReactElement[] {
  return [
    <Route
      key="exams"
      path={rel(home, paths.exams)}
      element={<Navigate to={paths.examsView} replace />}
    />,
    <Route key="exams-view" path={rel(home, paths.examsView)} element={<ExamsListPage />} />,
    <Route key="exams-create" path={rel(home, paths.examsCreate)} element={<ExamDetailPage />} />,
    <Route
      key="exam-candidates"
      path={rel(home, paths.examCandidates)}
      element={<ExamCandidatesPage />}
    />,
    <Route key="exam-detail" path={rel(home, paths.examDetail)} element={<ExamDetailPage />} />,
  ];
}
