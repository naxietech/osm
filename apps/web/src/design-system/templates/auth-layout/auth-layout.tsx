import React from 'react';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1B3A6B] to-[#0E7490] p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <p className="mb-2 text-center text-2xl font-bold text-[#1B3A6B]">OSES</p>
        <h1 className="mb-1 text-center text-xl font-semibold text-gray-800">{title}</h1>
        {subtitle && (
          <p className="mb-6 text-center text-sm text-gray-500">{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  );
}

export default AuthLayout;
