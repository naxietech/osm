import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';

import { cn } from '@/lib/utils';

import { Spinner } from '../spinner';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** The icon to show. Mark it `aria-hidden` — `label` is what gets announced. */
  icon: ReactNode;
  /**
   * What this button does, in words: "Reset password", "Suspend account".
   *
   * Required, because an icon alone says nothing to a screen reader and not much to a new
   * user either. It becomes both the accessible name and the hover tooltip, so the two can
   * never disagree.
   */
  label: string;
  /** `danger` for actions that take something away — suspending, revoking, deleting. */
  tone?: 'default' | 'danger';
  size?: 'sm' | 'md';
  isLoading?: boolean;
}

const toneClasses: Record<NonNullable<IconButtonProps['tone']>, string> = {
  default: 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'border-danger/30 bg-card text-danger hover:bg-danger hover:text-white',
};

const sizeClasses: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
};

/**
 * A square, icon-only button.
 *
 * For places where a full labelled button is too much furniture — table row actions above
 * all, where two or three word-buttons per row crowd out the data they belong to. The label
 * is not optional: an icon on its own is a guess for a sighted user and silence for everyone
 * else.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    tone = 'default',
    size = 'md',
    isLoading = false,
    disabled = false,
    type = 'button',
    className,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      title={label}
      aria-label={label}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        toneClasses[tone],
        sizeClasses[size],
        isDisabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" /> : icon}
    </button>
  );
});

export default IconButton;
