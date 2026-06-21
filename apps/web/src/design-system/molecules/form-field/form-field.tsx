import React from 'react';

import { Label } from '@/design-system/atoms/label';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  error,
  required = false,
  children,
  className,
}: FormFieldProps): React.ReactElement {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error && (
        <span role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}

export default FormField;
