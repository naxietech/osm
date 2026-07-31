/**
 * Single source of truth for route paths. Used by the router (route definitions +
 * redirects) and by roles.config (sidebar nav targets) so the two can't drift.
 */
export const ROUTES = {
  login: '/login',
  unauthorized: '/unauthorized',
  registerInstitute: '/register/institute', // public self-registration (no auth)
  changePassword: '/account/password', // own-account page, shared by every role

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
    instituteApprovals: '/admin/institutes/approvals',
    instituteDetail: '/admin/institutes/:id',
    roles: '/admin/roles',
    roleDetail: '/admin/roles/:id',
    users: '/admin/users',
    usersNew: '/admin/users/new',
    userDetail: '/admin/users/:id',
    checkers: '/admin/checkers',
    checkersView: '/admin/checkers/view',
    checkersAdd: '/admin/checkers/add',
    checkerApprovals: '/admin/checkers/approvals',
    checkerDetail: '/admin/checkers/:id',
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
    examsCreate: '/controller/exams/create',
    examDetail: '/controller/exams/:id',
    examCandidates: '/controller/exams/:id/candidates',
  },

  evaluator: {
    home: '/evaluator',
    // A checker does not assign work — the examiner does. This is their own queue,
    // drilled down exam → subject → answer.
    myWork: '/evaluator/my-work',
    workExam: '/evaluator/my-work/:examId',
    workSubject: '/evaluator/my-work/:examId/:subjectId',
    markAnswer: '/evaluator/my-work/:examId/:subjectId/:scriptId',
    history: '/evaluator/history',
    profile: '/evaluator/profile',
  },

  institute: {
    home: '/institute',
    checkers: '/institute/checkers',
    checkersView: '/institute/checkers/view',
    checkersAdd: '/institute/checkers/add',
    checkerDetail: '/institute/checkers/:id',
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

/**
 * Routes a signed-out visitor is meant to reach. `AuthProvider` skips the
 * `GET /auth/me` session check on these, so opening the login page costs no auth
 * requests at all — and no failed check, which is what would otherwise trigger a
 * pointless token renewal behind it.
 *
 * Add any new public route here. Forgetting only costs one wasted request, never
 * access: the route guards read the session, not this list.
 */
const PUBLIC_ROUTES: string[] = [ROUTES.login, ROUTES.unauthorized, ROUTES.registerInstitute];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}
