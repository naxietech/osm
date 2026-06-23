import { type InputHTMLAttributes, forwardRef, useId } from 'react';

import { Input } from '@/design-system/atoms/input';
import { cn } from '@/lib/utils';

export interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  /** Floating label shown inside the field. */
  label: string;
  /** Error message; when set the field turns red and the message is announced. */
  error?: string;
  /** Extra classes for the outer wrapper. */
  containerClassName?: string;
}

/**
 * Text field with a floating label: the label sits inside the input and floats up
 * on focus / when filled. On error the label, border and background go red and a
 * red message is wired to the input for assistive tech.
 *
 * The float is CSS-only via `peer` + `:placeholder-shown` (the input carries a
 * blank placeholder), so no JS state is needed. Reuses the Input atom for the box.
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { id, label, error, required, className, containerClassName, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  return (
    <div className={cn('w-full', containerClassName)}>
      <div className="relative">
        <Input
          ref={ref}
          id={fieldId}
          placeholder=" "
          required={required}
          error={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={cn('peer pb-1.5 pt-5', className)}
          {...rest}
        />
        <label
          htmlFor={fieldId}
          className={cn(
            'pointer-events-none absolute left-3 top-2 z-10 origin-top-left scale-75 text-base transition-all',
            'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100',
            'peer-focus:top-2 peer-focus:translate-y-0 peer-focus:scale-75',
            hasError ? 'text-danger' : 'text-muted-foreground peer-focus:text-brand',
          )}
        >
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          )}
        </label>
      </div>
      {hasError && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-danger-foreground">
          {error}
        </p>
      )}
    </div>
  );
});

export default FormField;
