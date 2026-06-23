import React, { createContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'oses-theme';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Reads the active theme — DOM first (set pre-paint by the index.html snippet), then storage. */
export function getStoredTheme(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* localStorage unavailable (private mode / SSR) — fall through */
  }
  return getSystemTheme();
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

/**
 * Default context value. Functional but non-reactive, so components that read the
 * theme (e.g. ThemeToggle) still work when rendered outside a provider — useful in
 * unit tests and isolated stories. The real reactive values come from ThemeProvider.
 */
export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: applyTheme,
  toggleTheme: () => applyTheme(getStoredTheme() === 'dark' ? 'light' : 'dark'),
});

export interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
