import { type SelectHTMLAttributes, forwardRef, useId } from 'react';

import { Select } from '@/design-system/atoms/select';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  /** Label shown above the control. */
  label: string;
  /** Selectable options. */
  options: SelectOption[];
  /** Error message; when set the control turns red and the message is announced. */
  error?: string;
  /** Placeholder option shown when no value is selected. */
  placeholder?: string;
  /** Extra classes for the outer wrapper. */
  containerClassName?: string;
}

/**
 * Labeled dropdown: a top-aligned label, the Select atom, and a reserved error
 * line (so showing/clearing an error never shifts layout). Mirrors FormField's
 * API (label, error, required) for selects. A disabled placeholder option is
 * rendered first when `placeholder` is provided and no value is chosen yet.
 */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, options, error, placeholder, required, className, containerClassName, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  return (
    <div className={cn('w-full', containerClassName)}>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      <Select
        ref={ref}
        id={fieldId}
        required={required}
        error={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={className}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      {/* Always rendered so the reserved line height keeps the field's size stable. */}
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

export default SelectField;
