/**
 * StudentForm (organism) — follows the SchoolForm reference pattern.
 * Formik + Yup, FormField (text) + SelectField (dropdown) + ImageUploadField
 * (photo), controlled by `mode`. Fields are grouped into iconed sections.
 *
 * Student-specific:
 * - School is a foreign key picked from `schoolOptions`; pass `lockSchool` (and a
 *   single-school list) for SCHOOL_STAFF, who can only enrol into their own school.
 *   School is also locked in edit mode (a move is a transfer, not an edit).
 * - PII fields (names, CNICs, DOB, mobiles, address, photo) are entered here; they
 *   never appear in list views.
 * - Enrollment status is shown in edit mode only (create defaults it to active).
 * - The photo is collected as a File (`photoFile`); the actual upload happens
 *   server-side later, so it isn't part of the typed CreateStudentDto contract.
 */
import React, { useState } from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import type { CreateStudentDto, EnrollmentStatus, Gender } from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import {
  FileText,
  GraduationCap,
  type LucideIcon,
  MapPin,
  Phone,
  User,
} from '@/design-system/atoms/icon';
import { FormField } from '@/design-system/molecules/form-field';
import { ImageUploadField } from '@/design-system/molecules/image-upload-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

/** Create payload plus the form-only photo file and edit-only enrollment status. */
export interface StudentFormPayload extends CreateStudentDto {
  /** Newly-picked photo (frontend-only; uploaded server-side later). */
  photoFile?: File;
  enrollmentStatus?: EnrollmentStatus;
}

export interface StudentFormProps {
  initialValues?: Partial<StudentFormPayload>;
  /** Schools the student can be enrolled into. */
  schoolOptions: SelectOption[];
  /** Lock the school field (SCHOOL_STAFF — own school only). */
  lockSchool?: boolean;
  onSubmit: (data: StudentFormPayload) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

/** All-string shape used by the form controls; cast to the payload on submit. */
interface StudentFormValues {
  schoolId: string;
  fullName: string;
  fatherOrGuardianName: string;
  fatherOrGuardianCnic: string;
  cnicOrBform: string;
  dateOfBirth: string;
  gender: string;
  fatherMobile: string;
  studentMobile: string;
  address: string;
  city: string;
  district: string;
  postalAddress: string;
  gradeId: string;
  enrollmentStatus: string;
}

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const GRADE_OPTIONS: SelectOption[] = [
  { value: '9', label: 'Grade 9 (SSC)' },
  { value: '10', label: 'Grade 10 (SSC)' },
  { value: '11', label: 'Grade 11 (HSSC)' },
  { value: '12', label: 'Grade 12 (HSSC)' },
];

const ENROLLMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'graduated', label: 'Graduated' },
];

const GRADE_VALUES = GRADE_OPTIONS.map((o) => o.value);

/** CNIC / B-Form: 13 digits, optionally dashed (xxxxx-xxxxxxx-x). */
const CNIC_REGEX = /^\d{5}-?\d{7}-?\d$/;
/** Pakistani mobile: 03xxxxxxxxx or +923xxxxxxxxx. */
const MOBILE_REGEX = /^(?:\+92|0)3\d{9}$/;
const MOBILE_MESSAGE = 'Enter a valid mobile number (e.g. 03001234567)';

const validationSchema = Yup.object({
  schoolId: Yup.string().required('Select a school'),
  fullName: Yup.string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(150, 'Full name is too long')
    .required('Full name is required'),
  fatherOrGuardianName: Yup.string()
    .trim()
    .min(2, 'Father / guardian name must be at least 2 characters')
    .max(150, 'Father / guardian name is too long')
    .required('Father / guardian name is required'),
  fatherOrGuardianCnic: Yup.string()
    .matches(CNIC_REGEX, { message: 'CNIC must be 13 digits', excludeEmptyString: true })
    .required('Father / guardian CNIC is required'),
  cnicOrBform: Yup.string().matches(CNIC_REGEX, {
    message: 'CNIC / B-Form must be 13 digits',
    excludeEmptyString: true,
  }),
  dateOfBirth: Yup.string()
    .required('Date of birth is required')
    .test(
      'not-future',
      'Date of birth cannot be in the future',
      (value) => !value || new Date(value) <= new Date(),
    ),
  gender: Yup.string()
    .oneOf(['male', 'female', 'other'], 'Select a gender')
    .required('Gender is required'),
  fatherMobile: Yup.string()
    .matches(MOBILE_REGEX, { message: MOBILE_MESSAGE, excludeEmptyString: true })
    .required("Father's mobile number is required"),
  studentMobile: Yup.string().matches(MOBILE_REGEX, {
    message: MOBILE_MESSAGE,
    excludeEmptyString: true,
  }),
  address: Yup.string()
    .trim()
    .min(5, 'Address must be at least 5 characters')
    .max(250, 'Address is too long')
    .required('Address is required'),
  city: Yup.string().trim().max(85, 'City is too long').required('City is required'),
  district: Yup.string().trim().max(85, 'District is too long').required('District is required'),
  postalAddress: Yup.string().trim().max(250, 'Postal address is too long'),
  gradeId: Yup.string().oneOf(GRADE_VALUES, 'Select a grade').required('Grade is required'),
  enrollmentStatus: Yup.string().oneOf(
    ['active', 'inactive', 'transferred', 'graduated'],
    'Select a status',
  ),
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

export function StudentForm({
  initialValues,
  schoolOptions,
  lockSchool = false,
  onSubmit,
  onCancel,
  isSubmitting,
  mode,
}: StudentFormProps): React.ReactElement {
  const [photo, setPhoto] = useState<File | null>(null);

  const formik = useFormik<StudentFormValues>({
    enableReinitialize: true,
    initialValues: {
      schoolId: initialValues?.schoolId ?? '',
      fullName: initialValues?.fullName ?? '',
      fatherOrGuardianName: initialValues?.fatherOrGuardianName ?? '',
      fatherOrGuardianCnic: initialValues?.fatherOrGuardianCnic ?? '',
      cnicOrBform: initialValues?.cnicOrBform ?? '',
      dateOfBirth: initialValues?.dateOfBirth ?? '',
      gender: initialValues?.gender ?? '',
      fatherMobile: initialValues?.fatherMobile ?? '',
      studentMobile: initialValues?.studentMobile ?? '',
      address: initialValues?.address ?? '',
      city: initialValues?.city ?? '',
      district: initialValues?.district ?? '',
      postalAddress: initialValues?.postalAddress ?? '',
      gradeId: initialValues?.gradeId != null ? String(initialValues.gradeId) : '',
      enrollmentStatus: initialValues?.enrollmentStatus ?? 'active',
    },
    validationSchema,
    onSubmit: (values) => {
      const dto: CreateStudentDto = {
        schoolId: values.schoolId,
        fullName: values.fullName.trim(),
        fatherOrGuardianName: values.fatherOrGuardianName.trim(),
        fatherOrGuardianCnic: values.fatherOrGuardianCnic.trim(),
        gender: values.gender as Gender,
        dateOfBirth: values.dateOfBirth,
        fatherMobile: values.fatherMobile.trim(),
        address: values.address.trim(),
        city: values.city.trim(),
        district: values.district.trim(),
        gradeId: Number(values.gradeId),
      };
      if (values.cnicOrBform) dto.cnicOrBform = values.cnicOrBform.trim();
      if (values.studentMobile) dto.studentMobile = values.studentMobile.trim();
      if (values.postalAddress) dto.postalAddress = values.postalAddress.trim();

      const payload: StudentFormPayload = { ...dto };
      if (photo) payload.photoFile = photo;
      if (mode === 'edit' && values.enrollmentStatus) {
        payload.enrollmentStatus = values.enrollmentStatus as EnrollmentStatus;
      }
      onSubmit(payload);
    },
  });

  /** Shared error resolver — only show an error once the field is touched. */
  const fieldError = (name: keyof StudentFormValues): string | undefined =>
    formik.touched[name] ? formik.errors[name] : undefined;

  /** Wires the custom SelectField (value + onChange/onBlur/error) to Formik. */
  const selectProps = (
    name: keyof StudentFormValues,
  ): {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    error: string | undefined;
  } => ({
    value: formik.values[name],
    onChange: (value: string) => void formik.setFieldValue(name, value),
    onBlur: () => void formik.setFieldTouched(name, true),
    error: fieldError(name),
  });

  const gridClass = 'grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 lg:grid-cols-3';

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="space-y-10">
      <section>
        <SectionHeading icon={GraduationCap}>School &amp; Class</SectionHeading>
        <div className={gridClass}>
          <SelectField
            id="schoolId"
            name="schoolId"
            label="School"
            options={schoolOptions}
            disabled={mode === 'edit' || lockSchool}
            required
            {...selectProps('schoolId')}
          />

          <SelectField
            id="gradeId"
            name="gradeId"
            label="Grade"
            options={GRADE_OPTIONS}
            required
            {...selectProps('gradeId')}
          />

          {mode === 'edit' && (
            <SelectField
              id="enrollmentStatus"
              name="enrollmentStatus"
              label="Enrollment Status"
              options={ENROLLMENT_STATUS_OPTIONS}
              required
              {...selectProps('enrollmentStatus')}
            />
          )}
        </div>
      </section>

      <section>
        <SectionHeading icon={User}>Student Details</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="fullName"
            name="fullName"
            label="Full Name"
            value={formik.values.fullName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('fullName')}
            required
          />

          <FormField
            id="fatherOrGuardianName"
            name="fatherOrGuardianName"
            label="Father / Guardian Name"
            value={formik.values.fatherOrGuardianName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('fatherOrGuardianName')}
            required
          />

          <SelectField
            id="gender"
            name="gender"
            label="Gender"
            options={GENDER_OPTIONS}
            required
            {...selectProps('gender')}
          />

          <FormField
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            label="Date of Birth"
            value={formik.values.dateOfBirth}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('dateOfBirth')}
            required
          />

          <ImageUploadField
            label="Student Photo (optional)"
            containerClassName="md:col-span-2 lg:col-span-3"
            value={photo}
            onChange={setPhoto}
            initialPreviewUrl={initialValues?.photoUrl}
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={FileText}>Identity Documents</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="cnicOrBform"
            name="cnicOrBform"
            label="Student CNIC / B-Form (optional)"
            inputMode="numeric"
            value={formik.values.cnicOrBform}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('cnicOrBform')}
          />

          <FormField
            id="fatherOrGuardianCnic"
            name="fatherOrGuardianCnic"
            label="Father / Guardian CNIC"
            inputMode="numeric"
            value={formik.values.fatherOrGuardianCnic}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('fatherOrGuardianCnic')}
            required
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={Phone}>Contact</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="fatherMobile"
            name="fatherMobile"
            type="tel"
            inputMode="numeric"
            label="Father's Mobile"
            value={formik.values.fatherMobile}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('fatherMobile')}
            required
          />

          <FormField
            id="studentMobile"
            name="studentMobile"
            type="tel"
            inputMode="numeric"
            label="Student's Mobile (optional)"
            value={formik.values.studentMobile}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('studentMobile')}
          />
        </div>
      </section>

      <section>
        <SectionHeading icon={MapPin}>Address</SectionHeading>
        <div className={gridClass}>
          <FormField
            id="address"
            name="address"
            label="Address"
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
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
            error={fieldError('city')}
            required
          />

          <FormField
            id="district"
            name="district"
            label="District"
            value={formik.values.district}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('district')}
            required
          />

          <FormField
            id="postalAddress"
            name="postalAddress"
            label="Postal Address (if different)"
            containerClassName="md:col-span-2 lg:col-span-3"
            value={formik.values.postalAddress}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={fieldError('postalAddress')}
          />
        </div>
      </section>

      <div className="flex gap-3 border-t border-border pt-6">
        <Button type="submit" size="lg" isLoading={isSubmitting}>
          {mode === 'create' ? 'Enrol Student' : 'Save Changes'}
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

export default StudentForm;
