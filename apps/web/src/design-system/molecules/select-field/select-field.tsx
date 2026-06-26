import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { Check, ChevronDown } from '@/design-system/atoms/icon';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  id?: string;
  /** Field name (kept for parity with form controls; not required by the dropdown). */
  name?: string;
  /** Floating label, matching FormField. */
  label: string;
  /** Selectable options. */
  options: SelectOption[];
  /** Currently selected value ('' when nothing is chosen). */
  value: string;
  /** Called with the chosen option's value. */
  onChange: (value: string) => void;
  /** Called when focus leaves the control (wire to Formik's setFieldTouched). */
  onBlur?: () => void;
  /** Error message; when set the control turns red and the message is announced. */
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Extra classes for the outer wrapper. */
  containerClassName?: string;
  /** Extra classes for the control button. */
  className?: string;
}

/**
 * Custom single-select dropdown built to match FormField: a floating label that
 * sits inside the control and floats up on focus / when a value is set, the same
 * box styling, and a reserved error line (so toggling an error never shifts the
 * layout).
 *
 * It is a real listbox combobox — not a native <select> — so it can carry the
 * floating label and styled options. Keyboard support: Up/Down/Enter/Space to
 * open and move, Enter/Space to choose, Escape to close, Home/End to jump.
 * Closes on outside click. ARIA: role="combobox" + role="listbox" / "option",
 * aria-expanded, aria-activedescendant, aria-selected.
 */
export function SelectField({
  id,
  name,
  label,
  options,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  containerClassName,
  className,
}: SelectFieldProps): ReactElement {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const labelId = `${fieldId}-label`;
  const valueId = `${fieldId}-value`;
  const listboxId = `${fieldId}-listbox`;
  const errorId = `${fieldId}-error`;
  const hasError = Boolean(error);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex]!.label : '';
  const floating = open || focused || value !== '';

  // While open: seed the active option and close on an outside pointer press.
  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    const onPointerDown = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, selectedIndex]);

  const choose = (index: number): void => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const handleBlur = (event: FocusEvent<HTMLButtonElement>): void => {
    setFocused(false);
    // Only treat it as "left the field" when focus moves outside the control.
    if (!containerRef.current?.contains(event.relatedTarget as Node)) {
      onBlur?.();
    }
  };

  return (
    <div className={cn('w-full', containerClassName)} ref={containerRef}>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          id={fieldId}
          name={name}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-invalid={hasError || undefined}
          aria-required={required || undefined}
          aria-describedby={hasError ? errorId : undefined}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          className={cn(
            'peer flex h-[60px] w-full items-center rounded-md border bg-card px-3 pr-10 pb-1.5 pt-[26px] text-left text-base font-normal text-foreground shadow-sm',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
            hasError
              ? 'border-danger bg-danger-subtle focus-visible:border-danger focus-visible:ring-danger'
              : 'border-input focus-visible:border-ring focus-visible:ring-ring',
            className,
          )}
        >
          <span id={valueId} className="block w-full truncate">
            {selectedLabel}
          </span>
        </button>

        <label
          id={labelId}
          htmlFor={fieldId}
          className={cn(
            'pointer-events-none absolute left-3 z-10 origin-top-left text-base transition-all',
            floating ? 'top-2 scale-75' : 'top-1/2 -translate-y-1/2 scale-100',
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

        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 transition-transform',
            open && 'rotate-180',
            hasError ? 'text-danger' : 'text-muted-foreground',
          )}
          aria-hidden
        />

        {open && !disabled && (
          <ul
            role="listbox"
            id={listboxId}
            aria-labelledby={labelId}
            aria-activedescendant={activeIndex >= 0 ? `${fieldId}-opt-${activeIndex}` : undefined}
            onMouseDown={(event) => event.preventDefault()}
            className="animate-dropdown absolute z-20 mt-2 max-h-64 w-full origin-top overflow-auto rounded-xl border border-border bg-card p-1.5 shadow-xl ring-1 ring-black/5"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li
                  key={option.value}
                  id={`${fieldId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive && 'bg-muted',
                    isSelected ? 'font-medium text-brand' : 'text-foreground',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
}

export default SelectField;
