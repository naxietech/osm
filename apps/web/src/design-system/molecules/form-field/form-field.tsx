import { type InputHTMLAttributes, type ReactNode, forwardRef, useId, useState } from 'react';

import { Eye, EyeOff } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { cn } from '@/lib/utils';

export interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  /** Floating label shown inside the field. */
  label: string;
  /** Error message; when set the field turns red and the message is announced. */
  error?: string;
  /** Icon rendered inside the field on the left (e.g. mail, lock). Optional. */
  leadingIcon?: ReactNode;
  /** Extra classes for the outer wrapper. */
  containerClassName?: string;
}

/**
 * Text field with a floating label: the label sits inside the input and floats up
 * on focus / when filled. On error the label, border and background go red and a
 * red message is wired to the input for assistive tech.
 *
 * Optional `leadingIcon` renders an icon on the left (and pads the text + label
 * clear of it). When `type="password"` a show/hide eye toggle is added on the
 * right that flips the input between password and text.
 *
 * The float is CSS-only via `peer` + `:placeholder-shown` (the input carries a
 * blank placeholder), so no JS state is needed. Reuses the Input atom for the box.
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  {
    id,
    type = 'text',
    label,
    error,
    required,
    leadingIcon,
    className,
    containerClassName,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const inputType = isPassword ? (revealed ? 'text' : 'password') : type;

  return (
    <div className={cn('w-full', containerClassName)}>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">
            {leadingIcon}
          </span>
        )}
        <Input
          ref={ref}
          id={fieldId}
          type={inputType}
          placeholder=" "
          required={required}
          error={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={cn(
            'peer pb-1.5 pt-[26px]',
            leadingIcon && 'pl-10',
            isPassword && 'pr-11',
            className,
          )}
          {...rest}
        />
        <label
          htmlFor={fieldId}
          className={cn(
            'pointer-events-none absolute top-2 z-10 origin-top-left scale-75 text-base transition-all',
            leadingIcon ? 'left-10' : 'left-3',
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
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className={cn(
              'absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded text-muted-foreground transition-colors',
              'hover:text-foreground focus-visible:text-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            {revealed ? (
              <EyeOff className="h-5 w-5" aria-hidden />
            ) : (
              <Eye className="h-5 w-5" aria-hidden />
            )}
          </button>
        )}
      </div>
      {/* Always rendered so the reserved line height keeps the field's size
          stable — showing/clearing an error never shifts the layout. */}
      <p
        id={errorId}
        role={hasError ? 'alert' : undefined}
        className="mt-1 min-h-4 text-xs text-danger-foreground"
      >
        {error}
      </p>
    </div>
  );
});

export default FormField;
