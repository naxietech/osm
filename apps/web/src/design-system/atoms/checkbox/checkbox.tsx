import { type InputHTMLAttributes, type ReactNode, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Content rendered beside the box, wrapped in a clickable `<label>`.
   * Omit it to render a bare input when the caller supplies its own label.
   */
  label?: ReactNode;
  /** Classes for the wrapping `<label>` — callers vary the text size, colour and gap. */
  labelClassName?: string;
  /** Renders the mixed (dash) state, e.g. a partially-selected "select all". */
  indeterminate?: boolean;
}

/**
 * The single checkbox control. Replaces the hand-rolled `<input type="checkbox">`
 * markup that had drifted across the app (some sites used `accent-brand`, others
 * the arbitrary `accent-[var(--brand)]`).
 *
 * `indeterminate` is a DOM property rather than an attribute, so it is applied
 * imperatively; a checked box always wins over the mixed state.
 */
export function Checkbox({
  label,
  labelClassName,
  indeterminate = false,
  className,
  disabled,
  ...rest
}: CheckboxProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const node = inputRef.current;
    if (node) node.indeterminate = indeterminate && !node.checked;
  }, [indeterminate, rest.checked]);

  const box = (
    <input
      ref={inputRef}
      type="checkbox"
      disabled={disabled}
      className={cn(
        'h-4 w-4 flex-none rounded border-input accent-brand',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  );

  if (label === undefined) return box;

  return (
    <label
      className={cn(
        'flex w-fit items-center gap-2 text-sm text-foreground',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
        labelClassName,
      )}
    >
      {box}
      {label}
    </label>
  );
}

export default Checkbox;
