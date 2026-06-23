import { useContext } from 'react';

import { ThemeContext, type ThemeContextValue } from './theme-provider';

/** Access the current theme (light/dark) and its setters. Safe to call without a provider. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
