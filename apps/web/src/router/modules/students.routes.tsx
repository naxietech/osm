/**
 * Students module routes — shared by ADMIN (all institutes) and INSTITUTE (its own,
 * narrowed by the `own-institute` permission scope rather than by the route tree).
 */
import React, { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

import { rel } from './rel';

const StudentsListPage = lazy(() => import('@/pages/students/students-list.page'));
const StudentDetailPage = lazy(() => import('@/pages/students/student-detail.page'));

/** The student paths a hosting role must declare in ROUTES. */
export interface StudentRoutePaths {
  students: string;
  studentsView: string;
  studentsManage: string;
  studentDetail: string;
}

export function studentRoutes(home: string, paths: StudentRoutePaths): React.ReactElement[] {
  return [
    <Route
      key="students"
      path={rel(home, paths.students)}
      element={<Navigate to={paths.studentsView} replace />}
    />,
    <Route
      key="students-view"
      path={rel(home, paths.studentsView)}
      element={<StudentsListPage />}
    />,
    <Route
      key="students-manage"
      path={rel(home, paths.studentsManage)}
      element={<StudentDetailPage />}
    />,
    <Route
      key="student-detail"
      path={rel(home, paths.studentDetail)}
      element={<StudentDetailPage />}
    />,
  ];
}
