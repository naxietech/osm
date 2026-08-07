/**
 * REFERENCE PATTERN — InstituteForm (organism)
 * This is the reference for all future domain forms.
 * Pattern: Formik + Yup validation, FormField (text) + SelectField (dropdown),
 * controlled by `mode` (create/edit). Submits a typed CreateInstituteDto.
 */
import React from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import {
  type CreateInstituteDto,
  type InstituteCategory,
  type InstituteQuestionAnswer,
  InstitutionType,
  Province,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import {
  Building2,
  ClipboardList,
  KeyRound,
  type LucideIcon,
  MapPin,
  Trash2,
  User,
} from '@/design-system/atoms/icon';
import { CategoryQuestionField } from '@/design-system/molecules/category-question-field';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

export interface InstituteFormProps {
  /**
   * Categories to choose from — the whole record, not just `{value,label}`.
   *
   * A category carries the questions an institute must answer, and this form used to take only
   * the option pair. It could therefore never ask them: picking "School" showed its name and
   * nothing else, and the institute was created with no answers to questions the category
   * requires. The dropdown options are derived from this list here.
   */
  categories: InstituteCategory[];
  initialValues?: Partial<CreateInstituteDto>;
  onSubmit: (data: CreateInstituteDto) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
  /**
   * Show the record without offering to change it — for a caller who holds `institutes.view`
   * but not `institutes.manage`. Every field is disabled and Save is withheld entirely: a
   * disabled Save button only invites "why can't I?", whereas an absent one is unambiguous.
   */
  readOnly?: boolean;
  /**
   * Delete this institute. Edit mode only, and rendered apart from Save — the same placement as
   * the category form, for the same reason: a destructive control beside the button people press
   * by habit is how it gets pressed by accident.
   */
  onDelete?: () => void;
}

/** All-string shape used by the form controls; cast to CreateInstituteDto on submit. */
interface InstituteFormValues {
  instituteCode: string;
  instituteName: string;
  branch: string;
  categoryId: string;
  institutionType: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
  /**
   * The institute's own sign-in password, create mode only. Supplying it is what makes the
   * account exist: without one the API stores the institute and nobody can ever sign in as it,
   * which is precisely the state this field was added to stop happening silently.
   */
  password: string;
  confirmPassword: string;
  /** Answers to the selected category's questions, keyed by question id. Always a list. */
  answers: Record<string, string[]>;
}

const INSTITUTION_TYPE_OPTIONS: SelectOption[] = [
  { value: InstitutionType.GOVERNMENT, label: 'Government' },
  { value: InstitutionType.PRIVATE, label: 'Private' },
  { value: InstitutionType.SEMI_GOVERNMENT, label: 'Semi-Government' },
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

const validationSchema = Yup.object({
  instituteCode: Yup.string()
    .trim()
    .min(2, 'Institute code must be at least 2 characters')
    .max(20, 'Institute code is too long')
    .required('Institute code is required'),
  instituteName: Yup.string()
    .trim()
    .min(2, 'Institute name must be at least 2 characters')
    .max(255, 'Institute name is too long')
    .required('Institute name is required'),
  categoryId: Yup.string().required('Select a category'),
  institutionType: Yup.string()
    .oneOf(Object.values(InstitutionType), 'Select an institution type')
    .required('Institution type is required'),
  address: Yup.string()
    .trim()
    .min(5, 'Address must be at least 5 characters')
    .max(500, 'Address is too long')
    .required('Address is required'),
  city: Yup.string()
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City is too long')
    .required('City is required'),
  province: Yup.string()
    .oneOf(Object.values(Province), 'Select a province / region')
    .required('Province / region is required'),
  postalCode: Yup.string().matches(/^\d{5}$/, {
    message: 'Postal code must be 5 digits',
    excludeEmptyString: true,
  }),
  contactPersonName: Yup.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(150, 'Name is too long')
    .required('Contact person name is required'),
  contactPersonDesignation: Yup.string()
    .trim()
    .min(2, 'Designation is too short')
    .max(100, 'Designation is too long')
    .required('Designation is required'),
  contactEmail: Yup.string()
    .email('Enter a valid email address')
    .required('Contact email is required'),
  contactPhone: Yup.string()
    .trim()
    .min(7, 'Phone number is too short')
    .max(30, 'Phone number is too long')
    .required('Contact phone is required'),
});

/**
 * Create mode adds the password pair on top. Separate schemas rather than conditional rules:
 * editing an institute never touches its password — that is the users screen's reset flow — and
 * a `.when('mode')` here would put a field in the schema that the edit form does not render.
 *
 * The minimum matches the API exactly. Stricter here would reject passwords the server accepts;
 * looser would let an admin fill the whole form and be refused at the end.
 */
const createValidationSchema = validationSchema.shape({
  password: Yup.string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .required('Choose a password for this institute'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'The two passwords do not match')
    .required('Confirm the password'),
});

/** Iconed section heading used to group related fields. */
function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{children}</h3>
    </div>
  );
}

export function InstituteForm({
  categories,
  readOnly = false,
  onDelete,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  mode,
}: InstituteFormProps): React.ReactElement {
  const formik = useFormik<InstituteFormValues>({
    enableReinitialize: true,
    initialValues: {
      instituteCode: initialValues?.instituteCode ?? '',
      instituteName: initialValues?.instituteName ?? '',
      branch: initialValues?.branch ?? '',
      categoryId: initialValues?.categoryId ?? '',
      institutionType: initialValues?.institutionType ?? '',
      address: initialValues?.address ?? '',
      city: initialValues?.city ?? '',
      province: initialValues?.province ?? '',
      postalCode: initialValues?.postalCode ?? '',
      contactPersonName: initialValues?.contactPersonName ?? '',
      contactPersonDesignation: initialValues?.contactPersonDesignation ?? '',
      contactEmail: initialValues?.contactEmail ?? '',
      contactPhone: initialValues?.contactPhone ?? '',
      password: '',
      confirmPassword: '',
      answers: Object.fromEntries(
        (initialValues?.answers ?? []).map((a) => [a.questionId, a.values]),
      ),
    },
    validationSchema: mode === 'create' ? createValidationSchema : validationSchema,
    onSubmit: (values) => {
      const dto: CreateInstituteDto = {
        instituteCode: values.instituteCode,
        instituteName: values.instituteName,
        categoryId: values.categoryId,
        institutionType: values.institutionType as InstitutionType,
        ...(values.branch.trim() ? { branch: values.branch.trim() } : {}),
        address: values.address,
        city: values.city,
        province: values.province as Province,
        contactPersonName: values.contactPersonName,
        contactPersonDesignation: values.contactPersonDesignation,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
      };
      if (values.postalCode) dto.postalCode = values.postalCode;

      if (mode === 'create') dto.password = values.password;

      // Only the selected category's questions travel. Answers left over from a category the
      // admin picked and then changed their mind about would be refused by the API as questions
      // that do not belong — and rightly so.
      const answers: InstituteQuestionAnswer[] = questions
        .map((q) => ({ questionId: q.id, values: values.answers[q.id] ?? [] }))
        .filter((a) => a.values.length > 0 && a.values.some((v) => v.trim() !== ''));

      // On an edit the set is sent even when empty, because the API reads an omitted `answers`
      // as "leave them alone" and an empty one as "clear them" — and the editor may have done
      // exactly that. On a create there is nothing to clear, so an empty set is simply left out.
      if (answers.length > 0) dto.answers = answers;
      else if (mode === 'edit' && questions.length > 0) dto.answers = [];

      onSubmit(dto);
    },
  });

  const categoryOptions: SelectOption[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  /**
   * The questions, driven by the category currently selected — asked and answerable in both
   * modes.
   *
   * The *category* stays locked on an edit and the answers do not, which is the distinction that
   * matters: what an institute is does not change, what it declared about itself does. A board
   * affiliation or a stated enrolment is exactly the sort of thing that goes stale.
   */
  const selectedCategory = categories.find((c) => c.id === formik.values.categoryId);
  const questions = selectedCategory?.questions ?? [];

  const setSingle = (questionId: string, value: string): void => {
    void formik.setFieldValue('answers', {
      ...formik.values.answers,
      [questionId]: value === '' ? [] : [value],
    });
  };

  const toggleMulti = (questionId: string, option: string, checked: boolean): void => {
    const current = formik.values.answers[questionId] ?? [];
    void formik.setFieldValue('answers', {
      ...formik.values.answers,
      [questionId]: checked ? [...current, option] : current.filter((v) => v !== option),
    });
  };

  /**
   * The plain string fields. `answers` is a record of lists, so it has neither a single error
   * string nor a single value — excluding it here is what keeps both helpers below honest
   * instead of casting at each call site.
   */
  type TextField = Exclude<keyof InstituteFormValues, 'answers'>;

  /** Shared error resolver — only show an error once the field is touched. */
  const fieldError = (name: TextField): string | undefined =>
    formik.touched[name] ? formik.errors[name] : undefined;

  /** Wires the custom SelectField (value + onChange/onBlur/error) to Formik. */
  const selectProps = (
    name: TextField,
  ): {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    error: string | undefined;
    disabled: boolean;
  } => ({
    value: formik.values[name],
    onChange: (value: string) => void formik.setFieldValue(name, value),
    onBlur: () => void formik.setFieldTouched(name, true),
    error: fieldError(name),
    disabled: readOnly,
  });

  const gridClass = 'grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 lg:grid-cols-3';

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="space-y-10">
      <section>
        <SectionHeading icon={Building2}>Institute Information</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="instituteName"
            name="instituteName"
            label="Institute / Institution Name"
            containerClassName="md:col-span-2 lg:col-span-3"
            value={formik.values.instituteName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={readOnly}
            error={fieldError('instituteName')}
            required
          />

          <FormField
            id="instituteCode"
            name="instituteCode"
            label="Institute / Institution Code"
            value={formik.values.instituteCode}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('instituteCode')}
            disabled={readOnly || mode === 'edit'}
            required
          />

          <FormField
            id="branch"
            name="branch"
            label="Branch / Campus"
            value={formik.values.branch}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={readOnly}
            error={fieldError('branch')}
          />

          <SelectField
            id="categoryId"
            name="categoryId"
            label="Category"
            options={categoryOptions}
            required
            {...selectProps('categoryId')}
          />

          <SelectField
            id="institutionType"
            name="institutionType"
            label="Institution Type"
            options={INSTITUTION_TYPE_OPTIONS}
            required
            {...selectProps('institutionType')}
          />
        </div>
      </section>

      {questions.length > 0 && (
        <section>
          <SectionHeading icon={ClipboardList}>{selectedCategory?.name} questions</SectionHeading>
          {mode === 'edit' && (
            <p className="-mt-2 mb-5 text-sm text-muted-foreground">
              Answered at registration. Saving replaces the whole set, so leave the ones that are
              still right exactly as they are.
            </p>
          )}
          <div className="space-y-5">
            {questions.map((q) => (
              <CategoryQuestionField
                key={q.id}
                id={q.id}
                text={q.text}
                type={q.type}
                required={q.required}
                options={q.options}
                values={formik.values.answers[q.id] ?? []}
                onSingle={(v) => setSingle(q.id, v)}
                onToggle={(opt, checked) => toggleMulti(q.id, opt, checked)}
                disabled={readOnly}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading icon={MapPin}>Address</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="address"
            name="address"
            label="Address"
            containerClassName="md:col-span-2 lg:col-span-3"
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={readOnly}
            error={fieldError('address')}
            required
          />

          <FormField
            id="city"
            name="city"
            label="City"
            value={formik.values.city}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={readOnly}
            error={fieldError('city')}
            required
          />

          <SelectField
            id="province"
            name="province"
            label="Province / Region"
            options={PROVINCE_OPTIONS}
            required
            {...selectProps('province')}
          />

          <FormField
            id="postalCode"
            name="postalCode"
            label="Postal Code (optional)"
            inputMode="numeric"
            value={formik.values.postalCode}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={readOnly}
            error={fieldError('postalCode')}
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={User}>Contact Person</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="contactPersonName"
            name="contactPersonName"
            label="Contact Person Name"
            value={formik.values.contactPersonName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={readOnly}
            error={fieldError('contactPersonName')}
            required
          />

          <FormField
            id="contactPersonDesignation"
            name="contactPersonDesignation"
            label="Designation"
            value={formik.values.contactPersonDesignation}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={readOnly}
            error={fieldError('contactPersonDesignation')}
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
            disabled={readOnly}
            error={fieldError('contactEmail')}
            required
          />

          <FormField
            id="contactPhone"
            name="contactPhone"
            type="tel"
            label="Contact Phone"
            value={formik.values.contactPhone}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={readOnly}
            error={fieldError('contactPhone')}
            required
          />
        </div>
      </section>

      {mode === 'create' && !readOnly && (
        <section>
          <SectionHeading icon={KeyRound}>Sign-in</SectionHeading>
          <p className="mb-5 -mt-2 text-sm text-muted-foreground">
            The institute signs in with its contact email and this password. Creating it here
            registers the account at the same time — without it the institute exists but nobody can
            sign in as it.
          </p>
          <div className={gridClass}>
            <FormField
              id="password"
              name="password"
              type="password"
              label="Password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={fieldError('password')}
              required
            />
            <FormField
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm Password"
              value={formik.values.confirmPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={fieldError('confirmPassword')}
              required
            />
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        {mode === 'edit' && !readOnly && onDelete && (
          <Button type="button" variant="danger" size="lg" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            Delete Institute
          </Button>
        )}
        {/* Pushes save/cancel away, so the destructive button is never adjacent to Save. */}
        <div className="ml-auto flex gap-3">
          {!readOnly && (
            <Button type="submit" size="lg" isLoading={isSubmitting}>
              {mode === 'create' ? 'Create & Register Institute' : 'Save Changes'}
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              {readOnly ? 'Back' : 'Cancel'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export default InstituteForm;
