import { UserRole } from '@oses/types';

import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  User,
  Users,
} from '@/design-system/atoms/icon';
import type { NavSection } from '@/design-system/organisms/sidebar';
import { ROUTES } from '@/router/routes';

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
          { label: 'Home', to: ROUTES.admin.home, icon: LayoutDashboard },
          {
            label: 'E-Sheet',
            icon: FileSpreadsheet,
            children: [
              { label: 'Add Template', to: ROUTES.admin.eSheetTemplateAdd },
              { label: 'View Template', to: ROUTES.admin.eSheetTemplateView },
              { label: 'Generate E-Sheets', to: ROUTES.admin.eSheetGenerate },
            ],
          },
          { label: 'Question Assignments', to: ROUTES.admin.questions, icon: ClipboardList },
          { label: 'Results', to: ROUTES.admin.results, icon: BarChart3 },
          {
            label: 'Schools',
            icon: Building2,
            children: [
              { label: 'View', to: ROUTES.admin.schoolsView },
              { label: 'Add', to: ROUTES.admin.schoolsAdd },
            ],
          },
          {
            label: 'Students',
            icon: Users,
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
          { label: 'Assign Work', to: ROUTES.evaluator.assignWork, icon: ClipboardCheck },
          { label: 'History', to: ROUTES.evaluator.history, icon: History },
          { label: 'Profile', to: ROUTES.evaluator.profile, icon: User },
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
          { label: 'Home', to: ROUTES.school.home, icon: LayoutDashboard },
          {
            label: 'Students',
            icon: Users,
            children: [
              { label: 'View', to: ROUTES.school.studentsView },
              { label: 'Add / Delete', to: ROUTES.school.studentsManage },
            ],
          },
          { label: 'Results', to: ROUTES.school.results, icon: BarChart3 },
          { label: 'Profile', to: ROUTES.school.profile, icon: User },
        ],
      },
    ],
  },
};
