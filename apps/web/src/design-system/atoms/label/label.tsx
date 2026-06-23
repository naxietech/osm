import { type LabelHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { required = false, className, children, ...rest },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn('block text-sm font-medium text-foreground', className)}
      {...rest}
    >
      {children}
      {required && (
        <span aria-hidden="true" className="ml-1 text-danger">
          *
        </span>
      )}
    </label>
  );
});

export default Label;
