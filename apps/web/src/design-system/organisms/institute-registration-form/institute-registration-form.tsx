/**
 * InstituteRegistrationForm (organism) — the body of the public self-registration
 * form. Presentational: it owns the working draft (scalar fields + category question
 * answers), validates it (required fields, email/phone format, unique institute code,
 * required category questions), and calls `onSubmit` with a ready RegisterInstituteDto.
 *
 * The page owns the surrounding chrome (header, success screen) and the service call.
 * `isCodeTaken` is injected so the organism stays free of service imports.
 */
import React, { useState } from 'react';

import {
  type CategoryQuestionType,
  GenderCategory,
  type InstituteCategory,
  InstituteLevel,
  type InstituteQuestionAnswer,
  InstitutionType,
  Province,
  type RegisterInstituteDto,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Input } from '@/design-system/atoms/input';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

const TYPE_OPTIONS: SelectOption[] = [
  { value: InstitutionType.GOVERNMENT, label: 'Government' },
  { value: InstitutionType.SEMI_GOVERNMENT, label: 'Semi-Government' },
  { value: InstitutionType.PRIVATE, label: 'Private' },
  { value: InstitutionType.OTHER, label: 'Other' },
];

const LEVEL_OPTIONS: SelectOption[] = [
  { value: InstituteLevel.SECONDARY, label: 'Secondary (SSC / Matric)' },
  { value: InstituteLevel.HIGHER_SECONDARY, label: 'Higher Secondary (HSSC / Inter)' },
  { value: InstituteLevel.BOTH, label: 'Both' },
];

const GENDER_OPTIONS: SelectOption[] = [
  { value: GenderCategory.BOYS, label: 'Boys' },
  { value: GenderCategory.GIRLS, label: 'Girls' },
  { value: GenderCategory.CO_EDUCATION, label: 'Co-education' },
];

const PROVINCE_OPTIONS: SelectOption[] = [
  { value: Province.PUNJAB, label: 'Punjab' },
  { value: Province.SINDH, label: 'Sindh' },
  { value: Province.KPK, label: 'Khyber Pakhtunkhwa' },
  { value: Province.BALOCHISTAN, label: 'Balochistan' },
  { value: Province.ICT, label: 'Islamabad (ICT)' },
  { value: Province.AJK, label: 'Azad Jammu & Kashmir' },
  { value: Province.GB, label: 'Gilgit-Baltistan' },
];

interface FormState {
  instituteName: string;
  branch: string;
  instituteCode: string;
  categoryId: string;
  institutionType: string;
  instituteLevel: string;
  category: string;
  address: string;
  province: string;
  city: string;
  postalCode: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
}

const EMPTY: FormState = {
  instituteName: '',
  branch: '',
  instituteCode: '',
  categoryId: '',
  institutionType: '',
  instituteLevel: '',
  category: '',
  address: '',
  province: '',
  city: '',
  postalCode: '',
  contactPersonName: '',
  contactPersonDesignation: '',
  contactEmail: '',
  contactPhone: '',
};

/** Loose but real checks — the backend re-validates; these just catch obvious typos. */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function isPhone(value: string): boolean {
  return /^[+\d][\d\s\-()]{6,}$/.test(value);
}

export interface InstituteRegistrationFormProps {
  /** Active categories (with their dynamic questions) the institute can register under. */
  categories: InstituteCategory[];
  /** Predicate to flag a duplicate government code (injected — no service import here). */
  isCodeTaken: (code: string) => boolean;
  onSubmit: (dto: RegisterInstituteDto) => void;
}

export function InstituteRegistrationForm({
  categories,
  isCodeTaken,
  onSubmit,
}: InstituteRegistrationFormProps): React.ReactElement {
  const categoryOptions: SelectOption[] = categories.map((c) => ({ value: c.id, label: c.name }));

  const [form, setForm] = useState<FormState>(EMPTY);
  // answers keyed by questionId; values is a list (one item for text/radio/select, many for checkbox)
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const questions = selectedCategory?.questions ?? [];

  const set = (key: keyof FormState, value: string): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const changeCategory = (value: string): void => {
    setForm((prev) => ({ ...prev, categoryId: value }));
    setAnswers({}); // questions changed
  };

  const setSingle = (qid: string, value: string): void =>
    setAnswers((prev) => ({ ...prev, [qid]: [value] }));
  const toggleMulti = (qid: string, option: string, checked: boolean): void =>
    setAnswers((prev) => {
      const current = prev[qid] ?? [];
      return {
        ...prev,
        [qid]: checked ? [...current, option] : current.filter((o) => o !== option),
      };
    });

  const requiredKeys: Array<keyof FormState> = [
    'instituteName',
    'instituteCode',
    'categoryId',
    'institutionType',
    'instituteLevel',
    'category',
    'address',
    'province',
    'city',
    'contactPersonName',
    'contactPersonDesignation',
    'contactEmail',
    'contactPhone',
  ];

  const email = form.contactEmail.trim();
  const phone = form.contactPhone.trim();
  const code = form.instituteCode.trim();
  const emailError = email.length > 0 && !isEmail(email) ? 'Enter a valid email address.' : '';
  const phoneError = phone.length > 0 && !isPhone(phone) ? 'Enter a valid phone number.' : '';
  const codeError =
    code.length > 0 && isCodeTaken(code) ? 'This institute code is already registered.' : '';

  const requiredQuestionsAnswered = questions
    .filter((q) => q.required)
    .every((q) => (answers[q.id] ?? []).some((v) => v.trim().length > 0));

  const canSubmit =
    requiredKeys.every((k) => form[k].trim().length > 0) &&
    isEmail(email) &&
    isPhone(phone) &&
    !codeError &&
    requiredQuestionsAnswered;

  const submit = (): void => {
    const questionAnswers: InstituteQuestionAnswer[] = questions
      .map((q) => ({ questionId: q.id, values: answers[q.id] ?? [] }))
      .filter((a) => a.values.length > 0);

    const dto: RegisterInstituteDto = {
      instituteName: form.instituteName.trim(),
      instituteCode: code,
      categoryId: form.categoryId,
      questionAnswers,
      institutionType: form.institutionType as InstitutionType,
      instituteLevel: form.instituteLevel as InstituteLevel,
      category: form.category as GenderCategory,
      address: form.address.trim(),
      province: form.province as Province,
      city: form.city.trim(),
      contactPersonName: form.contactPersonName.trim(),
      contactPersonDesignation: form.contactPersonDesignation.trim(),
      contactEmail: email,
      contactPhone: phone,
      ...(form.branch.trim() ? { branch: form.branch.trim() } : {}),
      ...(form.postalCode.trim() ? { postalCode: form.postalCode.trim() } : {}),
    };
    onSubmit(dto);
  };

  return (
    <div className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
      {/* Institute details */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Institute details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="instituteName"
            name="instituteName"
            label="Institute Name"
            value={form.instituteName}
            onChange={(e) => set('instituteName', e.target.value)}
            required
          />
          <FormField
            id="branch"
            name="branch"
            label="Branch / Campus"
            value={form.branch}
            onChange={(e) => set('branch', e.target.value)}
            required={false}
          />
          <FormField
            id="instituteCode"
            name="instituteCode"
            label="Institute Code (govt-provided)"
            value={form.instituteCode}
            onChange={(e) => set('instituteCode', e.target.value)}
            error={codeError}
            required
          />
          <SelectField
            label="Institute Category"
            options={categoryOptions}
            value={form.categoryId}
            onChange={changeCategory}
            required
          />
          <SelectField
            label="Type"
            options={TYPE_OPTIONS}
            value={form.institutionType}
            onChange={(v) => set('institutionType', v)}
            required
          />
          <SelectField
            label="Education Level"
            options={LEVEL_OPTIONS}
            value={form.instituteLevel}
            onChange={(v) => set('instituteLevel', v)}
            required
          />
          <SelectField
            label="Gender"
            options={GENDER_OPTIONS}
            value={form.category}
            onChange={(v) => set('category', v)}
            required
          />
        </div>
      </section>

      {/* Category questions */}
      {questions.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {selectedCategory?.name} questions
          </h2>
          <div className="space-y-5">
            {questions.map((q) => (
              <QuestionField
                key={q.id}
                id={q.id}
                text={q.text}
                type={q.type}
                required={q.required}
                options={q.options}
                values={answers[q.id] ?? []}
                onSingle={(v) => setSingle(q.id, v)}
                onToggle={(opt, checked) => toggleMulti(q.id, opt, checked)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Location */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="address"
            name="address"
            label="Address"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            required
            containerClassName="sm:col-span-2"
          />
          <SelectField
            label="Province"
            options={PROVINCE_OPTIONS}
            value={form.province}
            onChange={(v) => set('province', v)}
            required
          />
          <FormField
            id="city"
            name="city"
            label="City"
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            required
          />
          <FormField
            id="postalCode"
            name="postalCode"
            label="Postal Code"
            value={form.postalCode}
            onChange={(e) => set('postalCode', e.target.value)}
            required={false}
          />
        </div>
      </section>

      {/* Contact */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Contact person</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="contactPersonName"
            name="contactPersonName"
            label="Contact Name"
            value={form.contactPersonName}
            onChange={(e) => set('contactPersonName', e.target.value)}
            required
          />
          <FormField
            id="contactPersonDesignation"
            name="contactPersonDesignation"
            label="Designation"
            value={form.contactPersonDesignation}
            onChange={(e) => set('contactPersonDesignation', e.target.value)}
            required
          />
          <FormField
            id="contactEmail"
            name="contactEmail"
            type="email"
            label="Contact Email"
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
            error={emailError}
            required
          />
          <FormField
            id="contactPhone"
            name="contactPhone"
            label="Contact No"
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            error={phoneError}
            required
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button variant="primary" disabled={!canSubmit} onClick={submit}>
          Submit Registration
        </Button>
      </div>
    </div>
  );
}

/** Renders one category question with the control its answer type calls for. */
function QuestionField({
  id,
  text,
  type,
  required,
  options,
  values,
  onSingle,
  onToggle,
}: {
  id: string;
  text: string;
  type: CategoryQuestionType;
  required: boolean;
  options: string[];
  values: string[];
  onSingle: (value: string) => void;
  onToggle: (option: string, checked: boolean) => void;
}): React.ReactElement {
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
        />
      )}
      {type === 'file' && (
        <input
          type="file"
          aria-label={text}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand-subtle file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-foreground hover:file:bg-brand-subtle/80"
          onChange={(e) => onSingle(e.target.files?.[0]?.name ?? '')}
        />
      )}
      {type === 'select' && (
        <SelectField
          label="Select"
          options={options.map((o) => ({ value: o, label: o }))}
          value={values[0] ?? ''}
          onChange={onSingle}
        />
      )}
      {type === 'radio' && (
        <div className="flex flex-wrap gap-4">
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={id}
                className="h-4 w-4 accent-[var(--brand)]"
                checked={values[0] === opt}
                onChange={() => onSingle(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {type === 'checkbox' && (
        <div className="flex flex-wrap gap-4">
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-[var(--brand)]"
                checked={values.includes(opt)}
                onChange={(e) => onToggle(opt, e.target.checked)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default InstituteRegistrationForm;
