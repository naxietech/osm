/**
 * OSES design token — color palette.
 * These values must match tailwind.config.ts theme extension.
 * Use these tokens in TypeScript (e.g. for dynamic styles).
 * Use Tailwind classes in JSX (e.g. bg-navy text-teal-500).
 */
export const colors = {
  navy: {
    DEFAULT: '#1B3A6B',
    50: '#EFF6FF',
    100: '#DBEAFE',
    600: '#1D4ED8',
    700: '#1B3A6B',
    800: '#152E55',
    900: '#0F213E',
  },
  teal: {
    DEFAULT: '#0E7490',
    50: '#F0FDFA',
    100: '#CCFBF1',
    500: '#0E7490',
    600: '#0C6478',
  },
  gold: {
    DEFAULT: '#B45309',
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#B45309',
    600: '#92400E',
  },
  status: {
    pending: '#F59E0B',
    inProgress: '#3B82F6',
    complete: '#10B981',
    suspended: '#EF4444',
  },
} as const;

export type ColorToken = typeof colors;
