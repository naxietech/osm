import { type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Content rendered beside the dot, wrapped in a clickable `<label>`.
   * Omit it to render a bare input when the caller supplies its own label.
   */
  label?: ReactNode;
  /** Classes for the wrapping `<label>` — callers vary the text size, colour and gap. */
  labelClassName?: string;
}

/**
 * The single radio control — the counterpart to {@link Checkbox}, sharing its focus and
 * disabled treatment so the two read as one family. Group radios by giving them the same
 * `name`.
 */
export function Radio({
  label,
  labelClassName,
  className,
  disabled,
  ...rest
}: RadioProps): React.ReactElement {
  const dot = (
    <input
      type="radio"
      disabled={disabled}
      className={cn(
        'h-4 w-4 flex-none accent-brand',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  );

  if (label === undefined) return dot;

  return (
    <label
      className={cn(
        'flex w-fit items-center gap-2 text-sm text-foreground',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
        labelClassName,
      )}
    >
      {dot}
      {label}
    </label>
  );
}

export default Radio;
