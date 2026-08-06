/**
 * InstituteRegistrationForm (organism) — the body of the public self-registration
 * form. Presentational: Formik + Yup own the working draft (scalar fields + category
 * question answers) and the validation (required fields, email/phone format, unique
 * institute code, required category questions), and `onSubmit` receives a ready
 * RegisterInstituteDto.
 *
 * The dynamic category questions live under a single `answers` field rather than a
 * schema rebuilt per category: one object-level `.test()` reads the selected category
 * and checks its required questions, which keeps the schema static.
 *
 * The page owns the surrounding chrome (header, success screen) and the service call.
 * `isCodeTaken` is injected so the organism stays free of service imports.
 */
import React, { useMemo } from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import {
  type CategoryQuestionType,
  type InstituteCategory,
  type InstituteQuestionAnswer,
  InstitutionType,
  Province,
  type RegisterInstituteDto,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Checkbox } from '@/design-system/atoms/checkbox';
import { Input } from '@/design-system/atoms/input';
import { Radio } from '@/design-system/atoms/radio';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

const TYPE_OPTIONS: SelectOption[] = [
  { value: InstitutionType.GOVERNMENT, label: 'Government' },
  { value: InstitutionType.SEMI_GOVERNMENT, label: 'Semi-Government' },
  { value: InstitutionType.PRIVATE, label: 'Private' },
  { value: InstitutionType.OTHER, label: 'Other' },
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
  address: string;
  province: string;
  city: string;
  postalCode: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
  /**
   * The password this institute will sign in with once approved. Collected here because there
   * is no email service to send a temporary one with — it is hashed the moment it reaches the
   * API and held apart from the institute record until approval turns it into a login.
   */
  password: string;
  confirmPassword: string;
  /** Category question answers keyed by questionId (one value for single-answer types). */
  answers: Record<string, string[]>;
}

const EMPTY: FormState = {
  instituteName: '',
  branch: '',
  instituteCode: '',
  categoryId: '',
  institutionType: '',
  address: '',
  province: '',
  city: '',
  postalCode: '',
  contactPersonName: '',
  contactPersonDesignation: '',
  contactEmail: '',
  contactPhone: '',
  password: '',
  confirmPassword: '',
  answers: {},
};

/** Loose but real patterns — the backend re-validates; these just catch obvious typos. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s\-()]{6,}$/;

/** Scalar fields that are simply required, with the message each shows. */
const REQUIRED_TEXT: Array<[keyof FormState, string]> = [
  ['instituteName', 'Institute name is required'],
  ['categoryId', 'Institute category is required'],
  ['institutionType', 'Type is required'],
  ['address', 'Address is required'],
  ['province', 'Province is required'],
  ['city', 'City is required'],
  ['contactPersonName', 'Contact name is required'],
  ['contactPersonDesignation', 'Designation is required'],
];

export interface InstituteRegistrationFormProps {
  /** Active categories (with their dynamic questions) the institute can register under. */
  categories: InstituteCategory[];
  /**
   * Code and email, already checked for availability by the page before this form is shown.
   * They are pre-filled and left editable — a typo caught here is better than one caught by the
   * server — but a change to either is re-checked on submit by the API regardless.
   */
  initialCode?: string;
  initialEmail?: string;
  isSubmitting?: boolean;
  onSubmit: (dto: RegisterInstituteDto) => void;
}

export function InstituteRegistrationForm({
  categories,
  initialCode = '',
  initialEmail = '',
  isSubmitting = false,
  onSubmit,
}: InstituteRegistrationFormProps): React.ReactElement {
  const categoryOptions: SelectOption[] = categories.map((c) => ({ value: c.id, label: c.name }));

  const validationSchema = useMemo(() => {
    const shape: Record<string, Yup.AnySchema> = {
      // Availability is the server's answer, not a guess made here — the page asks before this
      // form is reached, and the API checks again on submit. A local predicate would only be a
      // second, staler copy of the same rule.
      instituteCode: Yup.string().trim().required('Institute code is required'),
      contactEmail: Yup.string()
        .trim()
        .required('Contact email is required')
        .matches(EMAIL_PATTERN, 'Enter a valid email address.'),
      contactPhone: Yup.string()
        .trim()
        .required('Contact phone is required')
        .matches(PHONE_PATTERN, 'Enter a valid phone number.'),
      // Matches the API exactly. A stricter rule here would reject passwords the server accepts;
      // a looser one would let the applicant fill in the whole form and be refused at the end.
      password: Yup.string()
        .min(8, 'Password must be at least 8 characters')
        .required('Choose a password'),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref('password')], 'The two passwords do not match')
        .required('Confirm the password'),
      // Every required question of the SELECTED category must carry a non-empty answer.
      answers: Yup.object().test(
        'required-questions',
        'Answer all required questions.',
        (value, ctx) => {
          const { categoryId } = ctx.parent as FormState;
          const questions = categories.find((c) => c.id === categoryId)?.questions ?? [];
          const given = (value ?? {}) as Record<string, string[]>;
          return questions
            .filter((q) => q.required)
            .every((q) => (given[q.id] ?? []).some((v) => v.trim().length > 0));
        },
      ),
    };
    for (const [key, message] of REQUIRED_TEXT) {
      shape[key] = Yup.string().trim().required(message);
    }
    return Yup.object(shape);
  }, [categories]);

  const formik = useFormik<FormState>({
    initialValues: { ...EMPTY, instituteCode: initialCode, contactEmail: initialEmail },
    validationSchema,
    // The submit button reflects validity from the first render, before any field is touched.
    validateOnMount: true,
    onSubmit: (values) => {
      const questions = categories.find((c) => c.id === values.categoryId)?.questions ?? [];
      const answers: InstituteQuestionAnswer[] = questions
        .map((q) => ({ questionId: q.id, values: values.answers[q.id] ?? [] }))
        .filter((a) => a.values.length > 0);

      const dto: RegisterInstituteDto = {
        instituteName: values.instituteName.trim(),
        instituteCode: values.instituteCode.trim(),
        categoryId: values.categoryId,
        answers,
        institutionType: values.institutionType as InstitutionType,
        address: values.address.trim(),
        province: values.province as Province,
        city: values.city.trim(),
        contactPersonName: values.contactPersonName.trim(),
        contactPersonDesignation: values.contactPersonDesignation.trim(),
        contactEmail: values.contactEmail.trim(),
        contactPhone: values.contactPhone.trim(),
        password: values.password,
        ...(values.branch.trim() ? { branch: values.branch.trim() } : {}),
        ...(values.postalCode.trim() ? { postalCode: values.postalCode.trim() } : {}),
      };
      onSubmit(dto);
    },
  });

  const selectedCategory = categories.find((c) => c.id === formik.values.categoryId);
  const questions = selectedCategory?.questions ?? [];

  /**
   * Show a field's error once the user has either left it or typed into it — a bad
   * email or an already-registered code must surface as it is typed, not only on blur.
   */
  const errorFor = (key: keyof Omit<FormState, 'answers'>): string | undefined =>
    formik.touched[key] || formik.values[key].length > 0 ? formik.errors[key] : undefined;

  const setValue = (key: keyof FormState, value: string): void =>
    void formik.setFieldValue(key, value, true);

  const changeCategory = (value: string): void => {
    // The question set changed, so previous answers no longer apply.
    void formik.setValues({ ...formik.values, categoryId: value, answers: {} }, true);
  };

  const setSingle = (qid: string, value: string): void =>
    void formik.setFieldValue('answers', { ...formik.values.answers, [qid]: [value] }, true);

  const toggleMulti = (qid: string, option: string, checked: boolean): void => {
    const current = formik.values.answers[qid] ?? [];
    const next = checked ? [...current, option] : current.filter((o) => o !== option);
    void formik.setFieldValue('answers', { ...formik.values.answers, [qid]: next }, true);
  };

  return (
    <form
      onSubmit={formik.handleSubmit}
      noValidate
      className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8"
    >
      {/* Institute details */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Institute details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="instituteName"
            name="instituteName"
            label="Institute Name"
            value={formik.values.instituteName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.instituteName ? formik.errors.instituteName : undefined}
            required
          />
          <FormField
            id="branch"
            name="branch"
            label="Branch / Campus"
            value={formik.values.branch}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            required={false}
          />
          <FormField
            id="instituteCode"
            name="instituteCode"
            label="Institute Code (govt-provided)"
            value={formik.values.instituteCode}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={errorFor('instituteCode')}
            required
          />
          <SelectField
            label="Institute Category"
            options={categoryOptions}
            value={formik.values.categoryId}
            onChange={changeCategory}
            required
          />
          <SelectField
            label="Type"
            options={TYPE_OPTIONS}
            value={formik.values.institutionType}
            onChange={(v) => setValue('institutionType', v)}
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
                values={formik.values.answers[q.id] ?? []}
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
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.address ? formik.errors.address : undefined}
            required
            containerClassName="sm:col-span-2"
          />
          <SelectField
            label="Province"
            options={PROVINCE_OPTIONS}
            value={formik.values.province}
            onChange={(v) => setValue('province', v)}
            required
          />
          <FormField
            id="city"
            name="city"
            label="City"
            value={formik.values.city}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.city ? formik.errors.city : undefined}
            required
          />
          <FormField
            id="postalCode"
            name="postalCode"
            label="Postal Code"
            value={formik.values.postalCode}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
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
            value={formik.values.contactPersonName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.contactPersonName ? formik.errors.contactPersonName : undefined}
            required
          />
          <FormField
            id="contactPersonDesignation"
            name="contactPersonDesignation"
            label="Designation"
            value={formik.values.contactPersonDesignation}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={
              formik.touched.contactPersonDesignation
                ? formik.errors.contactPersonDesignation
                : undefined
            }
            required
          />
          <FormField
            id="contactEmail"
            name="contactEmail"
            type="email"
            label="Contact Email"
            value={formik.values.contactEmail}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={errorFor('contactEmail')}
            required
          />
          <FormField
            id="contactPhone"
            name="contactPhone"
            label="Contact No"
            value={formik.values.contactPhone}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={errorFor('contactPhone')}
            required
          />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-foreground">Choose a password</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          This is the password your institute will sign in with once the registration is approved.
          Keep it safe — there is no automatic reset, so recovering it means contacting the board.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            label="Password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={errorFor('password')}
            required
          />
          <FormField
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            label="Confirm Password"
            value={formik.values.confirmPassword}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={errorFor('confirmPassword')}
            required
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!formik.isValid || isSubmitting}>
          Submit Registration
        </Button>
      </div>
    </form>
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
            <Radio
              key={opt}
              name={id}
              label={opt}
              checked={values[0] === opt}
              onChange={() => onSingle(opt)}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default InstituteRegistrationForm;
