/**
 * MultiSelectField (molecule) — a searchable multi-select DROPDOWN for long option
 * lists (subjects, institutes, …). Closed, it shows the selection as removable chips
 * (or a placeholder) and a "N selected" count, matching the single SelectField's box.
 * Click (or Enter/Space/↓) opens a popover with a search box, Select-all / Clear, and a
 * scrollable checkbox list; it closes on outside click or Escape.
 *
 * Controlled: pass `value` (selected ids) + `onChange(next)`.
 */
import { type KeyboardEvent, type ReactElement, useEffect, useMemo, useRef, useState } from 'react';

import { Check, ChevronDown, X } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { type SelectOption } from '@/design-system/molecules/select-field';
import { cn } from '@/lib/utils';

export interface MultiSelectFieldProps {
  label: string;
  options: SelectOption[];
  /** Selected option values. */
  value: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  error?: string;
  /** Max height of the scrollable option list. */
  listMaxHeight?: string;
  disabled?: boolean;
}

export function MultiSelectField({
  label,
  options,
  value,
  onChange,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches',
  error,
  listMaxHeight = '16rem',
  disabled = false,
}: MultiSelectFieldProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => new Set(value), [value]);
  const hasError = Boolean(error);
  const floating = open || value.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Focus the search box on open; close on outside pointer press.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const toggle = (id: string): void =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  const selectAllFiltered = (): void => {
    const next = new Set(value);
    filtered.forEach((o) => next.add(o.value));
    onChange([...next]);
  };
  const clear = (): void => onChange([]);
  const labelFor = (id: string): string => options.find((o) => o.value === id)?.label ?? id;

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (!open && ['Enter', ' ', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="w-full" ref={containerRef}>
      <div className="relative">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-disabled={disabled || undefined}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            'peer flex min-h-[60px] w-full flex-wrap items-center gap-1.5 rounded-md border bg-card px-3 pr-10 pb-1.5 pt-[26px] text-left text-base shadow-sm',
            'focus-visible:outline-none focus-visible:ring-1',
            disabled && 'cursor-not-allowed bg-muted',
            hasError
              ? 'border-danger bg-danger-subtle focus-visible:border-danger focus-visible:ring-danger'
              : 'border-input focus-visible:border-ring focus-visible:ring-ring',
          )}
        >
          {value.length === 0 ? (
            <span className="text-muted-foreground">&nbsp;</span>
          ) : (
            value.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-medium text-brand"
              >
                {labelFor(id)}
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${labelFor(id)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(id);
                    }}
                    className="rounded-full hover:text-brand/70"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        <label
          className={cn(
            'pointer-events-none absolute left-3 z-10 origin-top-left text-base transition-all',
            floating ? 'top-2 scale-75' : 'top-1/2 -translate-y-1/2 scale-100',
            hasError ? 'text-danger' : 'text-muted-foreground peer-focus:text-brand',
          )}
        >
          {label}
          {value.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">({value.length} selected)</span>
          )}
        </label>

        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-3 top-[26px] h-5 w-5 transition-transform',
            open && 'rotate-180',
            hasError ? 'text-danger' : 'text-muted-foreground',
          )}
          aria-hidden
        />

        {open && !disabled && (
          <div className="animate-dropdown absolute z-20 mt-2 w-full origin-top overflow-hidden rounded-xl border border-border bg-card shadow-xl ring-1 ring-black/5">
            <div className="border-b border-border p-2">
              <Input
                ref={searchRef}
                aria-label={`Search ${label}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
              />
              <div className="mt-2 flex justify-between px-1 text-xs">
                <button
                  type="button"
                  className="font-medium text-brand hover:underline disabled:opacity-40"
                  onClick={selectAllFiltered}
                  disabled={filtered.length === 0}
                >
                  Select all{query.trim() ? ' (filtered)' : ''}
                </button>
                <button
                  type="button"
                  className="font-medium text-muted-foreground hover:underline disabled:opacity-40"
                  onClick={clear}
                  disabled={value.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>

            <ul
              role="listbox"
              aria-multiselectable
              className="overflow-y-auto p-1.5"
              style={{ maxHeight: listMaxHeight }}
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {emptyMessage}
                </li>
              ) : (
                filtered.map((o) => {
                  const isSelected = selected.has(o.value);
                  return (
                    <li key={o.value} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => toggle(o.value)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                          isSelected
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-foreground hover:bg-muted/60',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            isSelected ? 'border-brand bg-brand text-white' : 'border-input',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" aria-hidden />}
                        </span>
                        <span className="truncate">{o.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      <p
        role={hasError ? 'alert' : undefined}
        className="mt-1 min-h-4 text-xs text-danger-foreground"
      >
        {error}
      </p>
    </div>
  );
}

export default MultiSelectField;
