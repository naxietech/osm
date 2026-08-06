import React from 'react';

import { Button } from '@/design-system/atoms/button';
import { Search, X } from '@/design-system/atoms/icon';
import { Input } from '@/design-system/atoms/input';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';
import { cn } from '@/lib/utils';

/** One dropdown in the bar. `''` always means "no filter" and renders as the `allLabel` row. */
export interface FilterBarSelect {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Text of the "no filter" row. Defaults to `All`. */
  allLabel?: string;
}

export interface FilterBarProps {
  /** The raw text in the box. Controlled and immediate — debounce in the page, not here. */
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Accessible name for the box; it has no visible label. */
  searchLabel?: string;
  filters?: FilterBarSelect[];
  /** Called by the Clear button, which only appears while something is narrowing the list. */
  onClear: () => void;
  className?: string;
}

/**
 * Search box + exact-match dropdowns above a list.
 *
 * The split is deliberate and mirrors the API: the box is a *search* (partial, fuzzy, scans),
 * the dropdowns are *filters* (exact, indexed, cheap). Folding the dropdowns into the box
 * would make every narrowing as expensive as the most expensive one.
 *
 * Fully controlled and stateless, so the page owns where the values live — which is what lets
 * the users list keep them in the URL and survive a refresh or a back button.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  searchLabel = 'Search',
  filters = [],
  onClear,
  className,
}: FilterBarProps): React.ReactElement {
  const isNarrowed = searchValue.trim().length > 0 || filters.some((f) => f.value !== '');

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start', className)}>
      <div className="relative flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label={searchLabel}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>

      {filters.map((filter) => (
        <SelectField
          key={filter.id}
          id={filter.id}
          label={filter.label}
          value={filter.value}
          onChange={filter.onChange}
          options={[{ value: '', label: filter.allLabel ?? 'All' }, ...filter.options]}
          containerClassName="sm:w-52"
        />
      ))}

      {isNarrowed && (
        <Button type="button" variant="ghost" onClick={onClear} className="sm:h-[60px]">
          <X className="mr-1 h-4 w-4" aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}

export default FilterBar;
