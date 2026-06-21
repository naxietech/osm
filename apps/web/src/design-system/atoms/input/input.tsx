import React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps {
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  autoComplete?: string;
}

export function Input({
  id,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error = false,
  disabled = false,
  className,
  autoComplete,
}: InputProps): React.ReactElement {
  return (
    <input
      id={id}
      name={name}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      autoComplete={autoComplete}
      className={cn(
        'block w-full rounded-md border px-3 py-2 text-gray-900 shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-offset-0',
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 focus:ring-[#0E7490]',
        disabled && 'cursor-not-allowed bg-gray-100 text-gray-500',
        className,
      )}
    />
  );
}

export default Input;
