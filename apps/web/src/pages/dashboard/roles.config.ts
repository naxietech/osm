import { UserRole } from '@oses/types';

import { ROUTES } from '@/router/routes';

export interface NavItem {
  label: string;
  /** Route to navigate to; omit when the item only groups a submenu. */
  to?: string;
  /** Submenu items (e.g. Students → View / Add-Delete). */
  children?: NavItem[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface RoleConfig {
  label: string;
  /** Landing route for this role. */
  home: string;
  nav: NavSection[];
}

/**
 * Per-role nav + landing route (4 API roles). ADMIN has all modules; the others
 * are limited. Module pages are shared and shown under each role that has them.
 */
export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  [UserRole.ADMIN]: {
    label: 'Admin',
    home: ROUTES.admin.home,
    nav: [
      {
        label: 'Menu',
        items: [
          { label: 'Home', to: ROUTES.admin.home },
          {
            label: 'E-Sheet',
            children: [
              { label: 'Add Template', to: ROUTES.admin.eSheetTemplateAdd },
              { label: 'View Template', to: ROUTES.admin.eSheetTemplateView },
              { label: 'Generate E-Sheets', to: ROUTES.admin.eSheetGenerate },
            ],
          },
          { label: 'Question Assignments', to: ROUTES.admin.questions },
          { label: 'Results', to: ROUTES.admin.results },
          {
            label: 'Schools',
            children: [
              { label: 'View', to: ROUTES.admin.schoolsView },
              { label: 'Add', to: ROUTES.admin.schoolsAdd },
            ],
          },
          {
            label: 'Students',
            children: [
              { label: 'View', to: ROUTES.admin.studentsView },
              { label: 'Add / Delete', to: ROUTES.admin.studentsManage },
            ],
          },
        ],
      },
    ],
  },
  [UserRole.CONTROLLER]: {
    label: 'Examiner',
    home: ROUTES.controller.home,
    nav: [
      {
        label: 'Menu',
        items: [
          { label: 'Home', to: ROUTES.controller.home },
          {
            label: 'E-Sheet',
            children: [
              { label: 'Add Template', to: ROUTES.controller.eSheetTemplateAdd },
              { label: 'View Template', to: ROUTES.controller.eSheetTemplateView },
              { label: 'Generate E-Sheets', to: ROUTES.controller.eSheetGenerate },
            ],
          },
          { label: 'Questions Assignment', to: ROUTES.controller.questions },
          { label: 'Result Compilation', to: ROUTES.controller.resultCompilation },
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
          { label: 'Home', to: ROUTES.evaluator.home },
          { label: 'Assign Work', to: ROUTES.evaluator.assignWork },
          { label: 'History', to: ROUTES.evaluator.history },
          { label: 'Profile', to: ROUTES.evaluator.profile },
        ],
      },
    ],
  },
  [UserRole.SCHOOL_STAFF]: {
    label: 'School',
    home: ROUTES.school.home,
    nav: [
      {
        label: 'Menu',
        items: [
          { label: 'Home', to: ROUTES.school.home },
          {
            label: 'Students',
            children: [
              { label: 'View', to: ROUTES.school.studentsView },
              { label: 'Add / Delete', to: ROUTES.school.studentsManage },
            ],
          },
          { label: 'Results', to: ROUTES.school.results },
          { label: 'Profile', to: ROUTES.school.profile },
        ],
      },
    ],
  },
};
