import { UserRole } from '@oses/types';

import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Lock,
  User,
  Users,
} from '@/design-system/atoms/icon';
import type { NavItem, NavSection } from '@/design-system/organisms/sidebar';
import { ROUTES } from '@/router/routes';

export interface RoleConfig {
  label: string;
  /** Landing route for this role. */
  home: string;
  nav: NavSection[];
}

/**
 * The back-office modules an Admin's grants actually cover (api `ADMIN_ACTIONS`):
 * institutes, students, checkers, exams, e-sheet templates, registrations, results.
 * Both admin roles share this list and the same `/admin` home.
 */
const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: ROUTES.admin.home, icon: LayoutDashboard, module: 'dashboard' },
  {
    label: 'E-Sheet',
    icon: FileSpreadsheet,
    module: 'e-sheet',
    children: [
      { label: 'Add Template', to: ROUTES.admin.eSheetTemplateAdd },
      { label: 'View Template', to: ROUTES.admin.eSheetTemplateView },
      { label: 'Generate E-Sheets', to: ROUTES.admin.eSheetGenerate },
    ],
  },
  {
    label: 'Question Assignments',
    to: ROUTES.admin.questions,
    icon: ClipboardList,
    module: 'questions',
  },
  { label: 'Results', to: ROUTES.admin.results, icon: BarChart3, module: 'results' },
  {
    label: 'Exams',
    icon: GraduationCap,
    module: 'exams',
    children: [
      { label: 'View', to: ROUTES.admin.examsView },
      { label: 'Create', to: ROUTES.admin.examsCreate },
    ],
  },
  {
    label: 'Checkers',
    icon: ClipboardCheck,
    module: 'checkers',
    children: [
      { label: 'View', to: ROUTES.admin.checkersView },
      { label: 'Add', to: ROUTES.admin.checkersAdd },
      { label: 'Approvals', to: ROUTES.admin.checkerApprovals },
    ],
  },
  {
    label: 'Institutes',
    icon: Building2,
    module: 'institutes',
    children: [
      { label: 'View', to: ROUTES.admin.institutesView },
      { label: 'Add', to: ROUTES.admin.institutesAdd },
      { label: 'Approvals', to: ROUTES.admin.instituteApprovals },
    ],
  },
  {
    label: 'Students',
    icon: Users,
    module: 'students',
    children: [
      { label: 'View', to: ROUTES.admin.studentsView },
      { label: 'Add / Delete', to: ROUTES.admin.studentsManage },
    ],
  },
];

/**
 * Platform administration — RBAC and the reference data every other module points at.
 * Super Admin only: the api withholds `roles.manage`, `users.manage`, `clients.manage`
 * and all reference-data grants from Admin, so showing these to an Admin would only
 * produce 403s. The matching routes are gated to SUPER_ADMIN in the router as well —
 * hiding a nav item is not access control.
 */
const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Roles & Permissions', to: ROUTES.admin.roles, icon: Lock, module: 'roles' },
  { label: 'Users', to: ROUTES.admin.users, icon: User, module: 'users' },
  {
    label: 'Setup',
    icon: FileText,
    module: 'reference-data',
    children: [
      { label: 'Institute Categories', to: ROUTES.admin.instituteCategories },
      { label: 'Subjects', to: ROUTES.admin.subjects },
      { label: 'SLOs', to: ROUTES.admin.slos },
      { label: 'Classes', to: ROUTES.admin.classes },
    ],
  },
];

/**
 * Per-role nav + landing route (5 TRD roles). Super Admin has every module; Admin is
 * the same back-office minus RBAC and reference data; the rest are narrower still.
 * Module pages are shared and shown under each role that has them.
 */
export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  [UserRole.SUPER_ADMIN]: {
    label: 'Super Admin',
    home: ROUTES.admin.home,
    nav: [{ label: 'Menu', items: [...ADMIN_NAV_ITEMS, ...SUPER_ADMIN_NAV_ITEMS] }],
  },
  [UserRole.ADMIN]: {
    label: 'Admin',
    home: ROUTES.admin.home,
    nav: [{ label: 'Menu', items: ADMIN_NAV_ITEMS }],
  },
  [UserRole.CONTROLLER]: {
    label: 'Examiner',
    home: ROUTES.controller.home,
    nav: [
      {
        label: 'Menu',
        items: [
          { label: 'Home', to: ROUTES.controller.home, icon: LayoutDashboard },
          {
            label: 'E-Sheet',
            icon: FileSpreadsheet,
            children: [
              { label: 'Add Template', to: ROUTES.controller.eSheetTemplateAdd },
              { label: 'View Template', to: ROUTES.controller.eSheetTemplateView },
              { label: 'Generate E-Sheets', to: ROUTES.controller.eSheetGenerate },
            ],
          },
          { label: 'Questions Assignment', to: ROUTES.controller.questions, icon: ClipboardList },
          {
            label: 'Exams',
            icon: GraduationCap,
            children: [
              { label: 'View', to: ROUTES.controller.examsView },
              { label: 'Create', to: ROUTES.controller.examsCreate },
            ],
          },
          {
            label: 'Result Compilation',
            to: ROUTES.controller.resultCompilation,
            icon: BarChart3,
          },
        ],
      },
    ],
  },
  [UserRole.EVALUATOR]: {
    label: 'Checker',
    home: ROUTES.evaluator.home,
    nav: [
      {
        label: 'Menu',
        items: [
          { label: 'Home', to: ROUTES.evaluator.home, icon: LayoutDashboard },
          { label: 'My Work', to: ROUTES.evaluator.myWork, icon: ClipboardCheck },
          { label: 'History', to: ROUTES.evaluator.history, icon: History },
          { label: 'Profile', to: ROUTES.evaluator.profile, icon: User },
        ],
      },
    ],
  },
  [UserRole.INSTITUTE]: {
    label: 'Institute',
    home: ROUTES.institute.home,
    nav: [
      {
        label: 'Menu',
        items: [
          { label: 'Home', to: ROUTES.institute.home, icon: LayoutDashboard },
          {
            label: 'Students',
            icon: Users,
            children: [
              { label: 'View', to: ROUTES.institute.studentsView },
              { label: 'Add / Delete', to: ROUTES.institute.studentsManage },
            ],
          },
          {
            label: 'Checkers',
            icon: ClipboardCheck,
            children: [
              { label: 'View', to: ROUTES.institute.checkersView },
              { label: 'Add', to: ROUTES.institute.checkersAdd },
            ],
          },
          { label: 'Exams', to: ROUTES.institute.examsView, icon: GraduationCap },
          { label: 'Results', to: ROUTES.institute.results, icon: BarChart3 },
          { label: 'Profile', to: ROUTES.institute.profile, icon: User },
        ],
      },
    ],
  },
};
