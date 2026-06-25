import React from 'react';

import { ThemeToggle } from '@/design-system/atoms/theme-toggle';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps): React.ReactElement {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-subtle via-background to-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xl">
        <p className="mb-2 text-center text-2xl font-bold text-brand">OSES</p>
        <h1 className="mb-1 text-center text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mb-6 text-center text-sm text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export default AuthLayout;
