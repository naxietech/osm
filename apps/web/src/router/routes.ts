/**
 * Single source of truth for route paths. Used by the router (route definitions +
 * redirects) and by roles.config (sidebar nav targets) so the two can't drift.
 */
export const ROUTES = {
  login: '/login',
  unauthorized: '/unauthorized',

  admin: {
    home: '/admin',
    eSheet: '/admin/e-sheet',
    eSheetTemplateAdd: '/admin/e-sheet/add-template',
    eSheetTemplateView: '/admin/e-sheet/view-template',
    eSheetGenerate: '/admin/e-sheet/generate',
    questions: '/admin/questions',
    results: '/admin/results',
    schools: '/admin/schools',
    schoolsView: '/admin/schools/view',
    schoolsAdd: '/admin/schools/add',
    schoolDetail: '/admin/schools/:id',
    students: '/admin/students',
    studentsView: '/admin/students/view',
    studentsManage: '/admin/students/manage',
    studentDetail: '/admin/students/:id',
  },

  controller: {
    home: '/controller',
    eSheet: '/controller/e-sheet',
    eSheetTemplateAdd: '/controller/e-sheet/add-template',
    eSheetTemplateView: '/controller/e-sheet/view-template',
    eSheetGenerate: '/controller/e-sheet/generate',
    questions: '/controller/questions',
    resultCompilation: '/controller/result-compilation',
  },

  evaluator: {
    home: '/evaluator',
    assignWork: '/evaluator/assign-work',
    history: '/evaluator/history',
    profile: '/evaluator/profile',
  },

  school: {
    home: '/school',
    students: '/school/students',
    studentsView: '/school/students/view',
    studentsManage: '/school/students/manage',
    studentDetail: '/school/students/:id',
    results: '/school/results',
    profile: '/school/profile',
  },
} as const;
