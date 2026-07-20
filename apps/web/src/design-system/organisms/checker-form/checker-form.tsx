/**
 * CheckerForm (organism) — register a checker (evaluator / paper marker).
 *
 * Used by BOTH entry points. When an institute user adds a checker, the page passes
 * `lockedInstituteId`: the type is forced to `school-specific` and the institute field
 * is fixed and read-only, so a school-specific checker can never be attached to a
 * school it doesn't belong to. The super admin gets the free choice, including
 * `general` (bound to no institute).
 *
 * Presentational and self-contained: Formik + Yup own the draft and validation, the
 * options and the `isCnicTaken` predicate are injected, and `onSubmit` emits a ready
 * CreateCheckerDto. The page owns the service call.
 */
import React, { useMemo } from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import {
  type CheckerDocument,
  type CheckerDocumentKind,
  type CheckerType,
  type CreateCheckerDto,
  type Gender,
  Province,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Checkbox } from '@/design-system/atoms/checkbox';
import {
  Building2,
  FileText,
  GraduationCap,
  type LucideIcon,
  MapPin,
  User,
} from '@/design-system/atoms/icon';
import { Radio } from '@/design-system/atoms/radio';
import { FormField } from '@/design-system/molecules/form-field';
import { MultiSelectField } from '@/design-system/molecules/multi-select-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

/** Loose but real — the backend re-validates; these catch obvious typos. */
const CNIC_REGEX = /^\d{5}-?\d{7}-?\d$/;
const MOBILE_REGEX = /^(?:\+92|0)3\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
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

/** The documents the approver reviews. `nomination` applies to school-specific only. */
const DOCUMENTS: Array<{ kind: CheckerDocumentKind; label: string; schoolOnly?: boolean }> = [
  { kind: 'qualification', label: 'Qualification certificate' },
  { kind: 'cnic', label: 'CNIC copy' },
  { kind: 'nomination', label: 'Nomination / appointment letter', schoolOnly: true },
];

interface CheckerFormValues {
  checkerType: CheckerType;
  instituteId: string;
  fullName: string;
  fatherOrGuardianName: string;
  cnic: string;
  gender: string;
  dateOfBirth: string;
  email: string;
  mobile: string;
  alternatePhone: string;
  address: string;
  city: string;
  district: string;
  province: string;
  highestQualification: string;
  specialization: string;
  designation: string;
  currentEmployer: string;
  yearsTeachingExperience: string;
  yearsMarkingExperience: string;
  subjectIds: string[];
  levelIds: string[];
  dailyCapacity: string;
  /** Picked file names keyed by document kind (frontend-only until storage exists). */
  documents: Partial<Record<CheckerDocumentKind, string>>;
  declarationAccepted: boolean;
}

export interface CheckerFormProps {
  /** Institutes selectable by a super admin. Ignored when `lockedInstituteId` is set. */
  instituteOptions: SelectOption[];
  subjectOptions: SelectOption[];
  levelOptions: SelectOption[];
  /**
   * Set by an institute user's page. Forces `school-specific` bound to this institute
   * and makes the classification read-only.
   */
  lockedInstituteId?: string;
  /** Flags a CNIC that is already registered (injected — no service import here). */
  isCnicTaken: (cnic: string) => boolean;
  onSubmit: (dto: CreateCheckerDto) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

/** Iconed section heading (matches InstituteForm / ExamForm). */
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

export function CheckerForm({
  instituteOptions,
  subjectOptions,
  levelOptions,
  lockedInstituteId,
  isCnicTaken,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CheckerFormProps): React.ReactElement {
  const locked = lockedInstituteId !== undefined;

  const validationSchema = useMemo(
    () =>
      Yup.object({
        checkerType: Yup.string().oneOf(['general', 'school-specific']).required(),
        // Required only for a school-specific checker — a general one has no institute.
        instituteId: Yup.string().when('checkerType', {
          is: 'school-specific',
          then: (schema) => schema.required('Select the institute this checker belongs to'),
        }),
        fullName: Yup.string().trim().min(3, 'Name is too short').required('Full name is required'),
        fatherOrGuardianName: Yup.string().trim().required("Father / guardian's name is required"),
        cnic: Yup.string()
          .trim()
          .required('CNIC is required')
          .matches(CNIC_REGEX, 'CNIC must be 13 digits')
          .test(
            'unique-cnic',
            'A checker with this CNIC is already registered.',
            (value) => !value || !isCnicTaken(value),
          ),
        gender: Yup.string().required('Select a gender'),
        dateOfBirth: Yup.string().required('Date of birth is required'),
        email: Yup.string()
          .trim()
          .required('Email is required')
          .matches(EMAIL_REGEX, 'Enter a valid email address'),
        mobile: Yup.string()
          .trim()
          .required('Mobile number is required')
          .matches(MOBILE_REGEX, 'Enter a valid Pakistani mobile number'),
        address: Yup.string().trim().required('Address is required'),
        city: Yup.string().trim().required('City is required'),
        province: Yup.string().required('Select a province'),
        highestQualification: Yup.string().trim().required('Highest qualification is required'),
        specialization: Yup.string().trim().required('Specialization / major is required'),
        yearsTeachingExperience: Yup.number()
          .typeError('Enter a number')
          .min(0, 'Cannot be negative')
          .required('Teaching experience is required'),
        yearsMarkingExperience: Yup.number()
          .typeError('Enter a number')
          .min(0, 'Cannot be negative')
          .required('Marking experience is required'),
        subjectIds: Yup.array().of(Yup.string().defined()).min(1, 'Select at least one subject.'),
        levelIds: Yup.array().of(Yup.string().defined()).min(1, 'Select at least one class.'),
        dailyCapacity: Yup.number().typeError('Enter a number').min(1, 'Must be at least 1'),
        // Credibility rests on the documents, so the qualification proof is mandatory.
        documents: Yup.object().test(
          'qualification-required',
          'Attach the qualification certificate.',
          (value) => Boolean((value as Record<string, string>)?.qualification),
        ),
        declarationAccepted: Yup.boolean().oneOf([true], 'You must accept the declaration.'),
      }),
    [isCnicTaken],
  );

  const formik = useFormik<CheckerFormValues>({
    initialValues: {
      checkerType: locked ? 'school-specific' : 'general',
      instituteId: lockedInstituteId ?? '',
      fullName: '',
      fatherOrGuardianName: '',
      cnic: '',
      gender: '',
      dateOfBirth: '',
      email: '',
      mobile: '',
      alternatePhone: '',
      address: '',
      city: '',
      district: '',
      province: '',
      highestQualification: '',
      specialization: '',
      designation: '',
      currentEmployer: '',
      yearsTeachingExperience: '',
      yearsMarkingExperience: '',
      subjectIds: [],
      levelIds: [],
      dailyCapacity: '',
      documents: {},
      declarationAccepted: false,
    },
    validationSchema,
    validateOnMount: true,
    onSubmit: (values) => {
      const documents: CheckerDocument[] = DOCUMENTS.filter(
        (d) => !(d.schoolOnly && values.checkerType !== 'school-specific'),
      )
        .map((d) => ({ kind: d.kind, fileName: values.documents[d.kind] ?? '' }))
        .filter((d) => d.fileName.length > 0);

      const dto: CreateCheckerDto = {
        checkerType: values.checkerType,
        fullName: values.fullName.trim(),
        fatherOrGuardianName: values.fatherOrGuardianName.trim(),
        cnic: values.cnic.trim(),
        gender: values.gender as Gender,
        dateOfBirth: values.dateOfBirth,
        email: values.email.trim(),
        mobile: values.mobile.trim(),
        address: values.address.trim(),
        city: values.city.trim(),
        province: values.province as Province,
        highestQualification: values.highestQualification.trim(),
        specialization: values.specialization.trim(),
        yearsTeachingExperience: Number(values.yearsTeachingExperience),
        yearsMarkingExperience: Number(values.yearsMarkingExperience),
        subjectIds: values.subjectIds,
        levelIds: values.levelIds,
        documents,
        declarationAccepted: values.declarationAccepted,
        // The page overrides these for an institute user; default is the super admin.
        addedBy: locked ? 'institute' : 'super-admin',
        ...(values.checkerType === 'school-specific' ? { instituteId: values.instituteId } : {}),
        ...(locked ? { addedByInstituteId: lockedInstituteId } : {}),
        ...(values.alternatePhone.trim() ? { alternatePhone: values.alternatePhone.trim() } : {}),
        ...(values.district.trim() ? { district: values.district.trim() } : {}),
        ...(values.designation.trim() ? { designation: values.designation.trim() } : {}),
        ...(values.currentEmployer.trim()
          ? { currentEmployer: values.currentEmployer.trim() }
          : {}),
        ...(values.dailyCapacity ? { dailyCapacity: Number(values.dailyCapacity) } : {}),
      };
      onSubmit(dto);
    },
  });

  /**
   * A field only complains once the user has engaged with it, or once they have tried to
   * submit. `validateOnMount` is on so the submit button can reflect validity from the
   * first render — without this gate, every required field would show its error on a
   * blank form.
   */
  const err = (name: keyof CheckerFormValues): string | undefined =>
    formik.touched[name] || formik.submitCount > 0
      ? (formik.errors[name] as string | undefined)
      : undefined;

  /**
   * Set a value and mark the field touched. Multi-selects, dropdowns and file inputs
   * never fire a blur, so choosing a value is the only "I have engaged with this" signal
   * they give.
   */
  const setField = (name: keyof CheckerFormValues, value: unknown): void => {
    void formik.setFieldValue(name, value, true);
    void formik.setFieldTouched(name, true, false);
  };

  const setType = (checkerType: CheckerType): void => {
    void formik.setValues(
      {
        ...formik.values,
        checkerType,
        // Clearing the institute keeps a general checker from carrying a stale binding.
        instituteId: checkerType === 'school-specific' ? formik.values.instituteId : '',
      },
      true,
    );
  };

  const pickDocument = (kind: CheckerDocumentKind, fileName: string): void =>
    setField('documents', { ...formik.values.documents, [kind]: fileName });

  const visibleDocuments = DOCUMENTS.filter(
    (d) => !(d.schoolOnly && formik.values.checkerType !== 'school-specific'),
  );
  const grid = 'grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 lg:grid-cols-3';

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="space-y-10">
      <section>
        <SectionHeading icon={Building2}>Classification</SectionHeading>
        {locked ? (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            This checker will be registered to your institute and may only mark its papers.
          </p>
        ) : (
          <div className="space-y-3">
            <Radio
              name="checkerType"
              label="General — not bound to an institute"
              checked={formik.values.checkerType === 'general'}
              onChange={() => setType('general')}
            />
            <Radio
              name="checkerType"
              label="School-specific — may only mark one institute's papers"
              checked={formik.values.checkerType === 'school-specific'}
              onChange={() => setType('school-specific')}
            />
            {formik.values.checkerType === 'school-specific' && (
              <div className="max-w-md pt-1">
                <SelectField
                  label="Institute"
                  options={instituteOptions}
                  value={formik.values.instituteId}
                  onChange={(v) => setField('instituteId', v)}
                  error={err('instituteId')}
                  required
                />
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <SectionHeading icon={User}>Personal</SectionHeading>
        <div className={grid}>
          <FormField
            id="fullName"
            name="fullName"
            label="Full Name"
            value={formik.values.fullName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('fullName')}
            required
          />
          <FormField
            id="fatherOrGuardianName"
            name="fatherOrGuardianName"
            label="Father / Guardian Name"
            value={formik.values.fatherOrGuardianName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('fatherOrGuardianName')}
            required
          />
          <FormField
            id="cnic"
            name="cnic"
            label="CNIC"
            value={formik.values.cnic}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={
              formik.values.cnic.length > 0 || formik.touched.cnic ? formik.errors.cnic : undefined
            }
            required
          />
          <SelectField
            label="Gender"
            options={GENDER_OPTIONS}
            value={formik.values.gender}
            onChange={(v) => setField('gender', v)}
            error={err('gender')}
            required
          />
          <FormField
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            label="Date of Birth"
            value={formik.values.dateOfBirth}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('dateOfBirth')}
            required
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={MapPin}>Contact</SectionHeading>
        <div className={grid}>
          <FormField
            id="email"
            name="email"
            type="email"
            label="Email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('email')}
            required
          />
          <FormField
            id="mobile"
            name="mobile"
            label="Mobile"
            value={formik.values.mobile}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('mobile')}
            required
          />
          <FormField
            id="alternatePhone"
            name="alternatePhone"
            label="Alternate Phone"
            value={formik.values.alternatePhone}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            required={false}
          />
          <FormField
            id="address"
            name="address"
            label="Address"
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('address')}
            required
            containerClassName="md:col-span-2"
          />
          <FormField
            id="city"
            name="city"
            label="City"
            value={formik.values.city}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('city')}
            required
          />
          <FormField
            id="district"
            name="district"
            label="District"
            value={formik.values.district}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            required={false}
          />
          <SelectField
            label="Province"
            options={PROVINCE_OPTIONS}
            value={formik.values.province}
            onChange={(v) => setField('province', v)}
            error={err('province')}
            required
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={GraduationCap}>Professional &amp; Qualification</SectionHeading>
        <div className={grid}>
          <FormField
            id="highestQualification"
            name="highestQualification"
            label="Highest Qualification"
            value={formik.values.highestQualification}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('highestQualification')}
            required
          />
          <FormField
            id="specialization"
            name="specialization"
            label="Specialization / Major"
            value={formik.values.specialization}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('specialization')}
            required
          />
          <FormField
            id="designation"
            name="designation"
            label="Designation"
            value={formik.values.designation}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            required={false}
          />
          <FormField
            id="currentEmployer"
            name="currentEmployer"
            label="Current Employer / Institute"
            value={formik.values.currentEmployer}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            required={false}
          />
          <FormField
            id="yearsTeachingExperience"
            name="yearsTeachingExperience"
            type="number"
            label="Years of Teaching Experience"
            value={formik.values.yearsTeachingExperience}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('yearsTeachingExperience')}
            required
          />
          <FormField
            id="yearsMarkingExperience"
            name="yearsMarkingExperience"
            type="number"
            label="Years of Marking Experience"
            value={formik.values.yearsMarkingExperience}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('yearsMarkingExperience')}
            required
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={FileText}>Marking Scope</SectionHeading>
        <p className="mb-3 text-xs text-muted-foreground">
          What this checker is allowed to mark. The approver confirms it before activation.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <MultiSelectField
            label="Subjects"
            options={subjectOptions}
            value={formik.values.subjectIds}
            onChange={(next) => setField('subjectIds', next)}
            searchPlaceholder="Search subjects…"
            emptyMessage="No subjects match"
            error={err('subjectIds')}
          />
          <MultiSelectField
            label="Classes"
            options={levelOptions}
            value={formik.values.levelIds}
            onChange={(next) => setField('levelIds', next)}
            searchPlaceholder="Search classes…"
            emptyMessage="No classes match"
            error={err('levelIds')}
          />
        </div>
        <div className="mt-2 max-w-xs">
          <FormField
            id="dailyCapacity"
            name="dailyCapacity"
            type="number"
            label="Preferred daily capacity (scripts)"
            value={formik.values.dailyCapacity}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={err('dailyCapacity')}
            required={false}
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={FileText}>Supporting Documents</SectionHeading>
        <p className="mb-3 text-xs text-muted-foreground">
          These are what the approver reviews to judge credibility. The qualification certificate is
          required.
        </p>
        <div className="space-y-4">
          {visibleDocuments.map((doc) => (
            <div key={doc.kind}>
              <p className="mb-1.5 text-sm font-medium text-foreground">
                {doc.label}
                {doc.kind === 'qualification' && (
                  <span className="ml-0.5 text-danger-foreground">*</span>
                )}
              </p>
              <input
                type="file"
                aria-label={doc.label}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand-subtle file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-foreground hover:file:bg-brand-subtle/80"
                onChange={(e) => pickDocument(doc.kind, e.target.files?.[0]?.name ?? '')}
              />
              {formik.values.documents[doc.kind] && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Attached: {formik.values.documents[doc.kind]}
                </p>
              )}
            </div>
          ))}
          {err('documents') && (
            <p className="text-xs font-medium text-danger-foreground">{err('documents')}</p>
          )}
        </div>
      </section>

      <section>
        <Checkbox
          checked={formik.values.declarationAccepted}
          onChange={(e) => setField('declarationAccepted', e.target.checked)}
          labelClassName="items-start gap-3"
          label={
            <span className="text-sm text-muted-foreground">
              I confirm the details above are correct, and that this checker agrees to the
              confidentiality undertaking and the board&rsquo;s marking guidelines.
            </span>
          }
        />
      </section>

      <div className="flex gap-3 border-t border-border pt-6">
        <Button type="submit" size="lg" isLoading={isSubmitting} disabled={!formik.isValid}>
          Submit for Approval
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default CheckerForm;
