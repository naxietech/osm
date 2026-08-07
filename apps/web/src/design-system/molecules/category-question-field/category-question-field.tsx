import React from 'react';

import type { CategoryQuestionType } from '@oses/types';

import { Checkbox } from '@/design-system/atoms/checkbox';
import { Input } from '@/design-system/atoms/input';
import { Radio } from '@/design-system/atoms/radio';

import { SelectField } from '../select-field';

export interface CategoryQuestionFieldProps {
  /** The question's stable id — also the radio group name, so two questions never share one. */
  id: string;
  text: string;
  type: CategoryQuestionType;
  required: boolean;
  options: string[];
  /**
   * The answer, always a list. A single-value question uses one entry; only `checkbox` uses
   * more. One shape for every type keeps the caller's answer map uniform, which is what lets it
   * be submitted without a per-type branch.
   */
  values: string[];
  /** Set the answer for a single-value question (text, file, select, radio). */
  onSingle: (value: string) => void;
  /** Add or remove one option on a multi-value (checkbox) question. */
  onToggle: (option: string, checked: boolean) => void;
  /**
   * Show the answer without offering to change it.
   *
   * Used on the institute edit form: the API refuses `answers` on an update outright, because a
   * stored answer is what an institute declared at registration. Rendering the questions as live
   * controls there would be a form that looks like it saved and did not; hiding them altogether
   * loses information the editor came to see. Disabled is the honest middle.
   */
  disabled?: boolean;
}

/**
 * One institute-category question, rendered with the control its answer type calls for.
 *
 * A molecule rather than a helper inside one form: both the public registration form and the
 * admin's institute form ask the same questions of the same categories, and organisms may not
 * import one another. Keeping one copy is what stops the two screens drifting into asking the
 * same question two different ways — or, as happened, one of them not asking at all.
 *
 * Presentational: it holds no state and knows nothing about categories, validation or
 * submission. The parent owns the answer map and decides what "required" means.
 */
export function CategoryQuestionField({
  id,
  text,
  type,
  required,
  options,
  values,
  onSingle,
  onToggle,
  disabled = false,
}: CategoryQuestionFieldProps): React.ReactElement {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">
        {text}
        {required && <span className="ml-0.5 text-danger-foreground">*</span>}
      </p>
      {type === 'text' && (
        <Input
          aria-label={text}
          value={values[0] ?? ''}
          onChange={(e) => onSingle(e.target.value)}
          placeholder="Your answer"
          disabled={disabled}
        />
      )}
      {type === 'file' && (
        <input
          type="file"
          aria-label={text}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand-subtle file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-foreground hover:file:bg-brand-subtle/80"
          onChange={(e) => onSingle(e.target.files?.[0]?.name ?? '')}
          disabled={disabled}
        />
      )}
      {type === 'select' && (
        <SelectField
          label={text}
          options={options.map((o) => ({ value: o, label: o }))}
          value={values[0] ?? ''}
          onChange={onSingle}
          disabled={disabled}
        />
      )}
      {type === 'radio' && (
        <div className="flex flex-wrap gap-4">
          {options.map((opt) => (
            <Radio
              key={opt}
              name={id}
              label={opt}
              checked={values[0] === opt}
              onChange={() => onSingle(opt)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
      {type === 'checkbox' && (
        <div className="flex flex-wrap gap-4">
          {options.map((opt) => (
            <Checkbox
              key={opt}
              checked={values.includes(opt)}
              onChange={(e) => onToggle(opt, e.target.checked)}
              label={opt}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryQuestionField;
