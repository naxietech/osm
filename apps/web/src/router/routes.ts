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
    exams: '/admin/exams',
    examsView: '/admin/exams/view',
    examsCreate: '/admin/exams/create',
    examDetail: '/admin/exams/:id',
    examCandidates: '/admin/exams/:id/candidates',
    institutes: '/admin/institutes',
    institutesView: '/admin/institutes/view',
    institutesAdd: '/admin/institutes/add',
    instituteDetail: '/admin/institutes/:id',
    roles: '/admin/roles',
    rolesNew: '/admin/roles/new',
    roleDetail: '/admin/roles/:id',
    users: '/admin/users',
    usersNew: '/admin/users/new',
    userDetail: '/admin/users/:id',
    instituteCategories: '/admin/institute-categories',
    subjects: '/admin/subjects',
    slos: '/admin/slos',
    classes: '/admin/classes',
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
    exams: '/controller/exams',
    examsView: '/controller/exams/view',
    examCandidates: '/controller/exams/:id/candidates',
  },

  evaluator: {
    home: '/evaluator',
    assignWork: '/evaluator/assign-work',
    history: '/evaluator/history',
    profile: '/evaluator/profile',
  },

  institute: {
    home: '/institute',
    students: '/institute/students',
    studentsView: '/institute/students/view',
    studentsManage: '/institute/students/manage',
    studentDetail: '/institute/students/:id',
    exams: '/institute/exams',
    examsView: '/institute/exams/view',
    examRegister: '/institute/exams/:id/register',
    results: '/institute/results',
    profile: '/institute/profile',
  },
} as const;
