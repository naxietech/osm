/**
 * Evaluator (checker) module routes — the marker's own workspace.
 *
 * My Work drills down in three steps: exam → subject → one answer to mark. The paths
 * nest to match, so the browser's own Back button walks the checker back up the levels.
 *
 * Only the EVALUATOR role mounts these. They are still declared through a factory like
 * every other module so the pattern holds if a supervisor role later gets a read-only
 * view of the same screens.
 */
import React, { lazy } from 'react';
import { Route } from 'react-router-dom';

import { rel } from './rel';

const EvaluatorQueuePage = lazy(() => import('@/pages/evaluator/evaluator-queue.page'));
const EvaluatorExamPage = lazy(() => import('@/pages/evaluator/evaluator-exam.page'));
const EvaluatorSubjectPage = lazy(() => import('@/pages/evaluator/evaluator-subject.page'));
const EvaluatorMarkingPage = lazy(() => import('@/pages/evaluator/evaluator-marking.page'));
const EvaluatorHistoryPage = lazy(() => import('@/pages/evaluator/evaluator-history.page'));
const EvaluatorProfilePage = lazy(() => import('@/pages/evaluator/evaluator-profile.page'));

/** The evaluator paths a hosting role must declare in ROUTES. */
export interface EvaluatorRoutePaths {
  myWork: string;
  workExam: string;
  workSubject: string;
  markAnswer: string;
  history: string;
  profile: string;
}

export function evaluatorRoutes(home: string, paths: EvaluatorRoutePaths): React.ReactElement[] {
  return [
    <Route key="my-work" path={rel(home, paths.myWork)} element={<EvaluatorQueuePage />} />,
    // Each level is a deeper path than the one above it, so none can shadow another —
    // React Router ranks by specificity, not declaration order.
    <Route key="work-exam" path={rel(home, paths.workExam)} element={<EvaluatorExamPage />} />,
    <Route
      key="work-subject"
      path={rel(home, paths.workSubject)}
      element={<EvaluatorSubjectPage />}
    />,
    <Route
      key="mark-answer"
      path={rel(home, paths.markAnswer)}
      element={<EvaluatorMarkingPage />}
    />,
    <Route key="history" path={rel(home, paths.history)} element={<EvaluatorHistoryPage />} />,
    <Route key="profile" path={rel(home, paths.profile)} element={<EvaluatorProfilePage />} />,
  ];
}
