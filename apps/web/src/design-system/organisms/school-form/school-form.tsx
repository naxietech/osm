/**
 * REFERENCE PATTERN — SchoolForm (organism)
 * This is the reference for all future domain forms.
 * Pattern: Formik + Yup validation, FormField (text) + SelectField (dropdown),
 * controlled by `mode` (create/edit). Submits a typed CreateSchoolDto.
 */
import React from 'react';

import { useFormik } from 'formik';
import * as Yup from 'yup';

import {
  type CreateSchoolDto,
  InstitutionType,
  Province,
  SchoolCategory,
  SchoolLevel,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

export interface SchoolFormProps {
  initialValues?: Partial<CreateSchoolDto>;
  onSubmit: (data: CreateSchoolDto) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

/** All-string shape used by the form controls; cast to CreateSchoolDto on submit. */
interface SchoolFormValues {
  schoolCode: string;
  schoolName: string;
  registrationNo: string;
  institutionType: string;
  schoolLevel: string;
  category: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactEmail: string;
  contactPhone: string;
}

const INSTITUTION_TYPE_OPTIONS: SelectOption[] = [
  { value: InstitutionType.GOVERNMENT, label: 'Government' },
  { value: InstitutionType.PRIVATE, label: 'Private' },
  { value: InstitutionType.FEDERAL, label: 'Federal' },
  { value: InstitutionType.OTHER, label: 'Other' },
];

const SCHOOL_LEVEL_OPTIONS: SelectOption[] = [
  { value: SchoolLevel.SECONDARY, label: 'Secondary (SSC / Matric)' },
  { value: SchoolLevel.HIGHER_SECONDARY, label: 'Higher Secondary (HSSC / Intermediate)' },
  { value: SchoolLevel.BOTH, label: 'Both' },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: SchoolCategory.BOYS, label: 'Boys' },
  { value: SchoolCategory.GIRLS, label: 'Girls' },
  { value: SchoolCategory.CO_EDUCATION, label: 'Co-education' },
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
  schoolCode: Yup.string()
    .trim()
    .min(2, 'School code must be at least 2 characters')
    .max(20, 'School code is too long')
    .required('School code is required'),
  schoolName: Yup.string()
    .trim()
    .min(2, 'School name must be at least 2 characters')
    .max(255, 'School name is too long')
    .required('School name is required'),
  registrationNo: Yup.string()
    .trim()
    .min(2, 'Registration number is too short')
    .max(50, 'Registration number is too long')
    .required('Registration / affiliation number is required'),
  institutionType: Yup.string()
    .oneOf(Object.values(InstitutionType), 'Select an institution type')
    .required('Institution type is required'),
  schoolLevel: Yup.string()
    .oneOf(Object.values(SchoolLevel), 'Select a school level')
    .required('School level is required'),
  category: Yup.string()
    .oneOf(Object.values(SchoolCategory), 'Select a category')
    .required('Category is required'),
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

export function SchoolForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  mode,
}: SchoolFormProps): React.ReactElement {
  const formik = useFormik<SchoolFormValues>({
    enableReinitialize: true,
    initialValues: {
      schoolCode: initialValues?.schoolCode ?? '',
      schoolName: initialValues?.schoolName ?? '',
      registrationNo: initialValues?.registrationNo ?? '',
      institutionType: initialValues?.institutionType ?? '',
      schoolLevel: initialValues?.schoolLevel ?? '',
      category: initialValues?.category ?? '',
      address: initialValues?.address ?? '',
      city: initialValues?.city ?? '',
      province: initialValues?.province ?? '',
      postalCode: initialValues?.postalCode ?? '',
      contactPersonName: initialValues?.contactPersonName ?? '',
      contactPersonDesignation: initialValues?.contactPersonDesignation ?? '',
      contactEmail: initialValues?.contactEmail ?? '',
      contactPhone: initialValues?.contactPhone ?? '',
    },
    validationSchema,
    onSubmit: (values) => {
      const dto: CreateSchoolDto = {
        schoolCode: values.schoolCode,
        schoolName: values.schoolName,
        registrationNo: values.registrationNo,
        institutionType: values.institutionType as InstitutionType,
        schoolLevel: values.schoolLevel as SchoolLevel,
        category: values.category as SchoolCategory,
        address: values.address,
        city: values.city,
        province: values.province as Province,
        contactPersonName: values.contactPersonName,
        contactPersonDesignation: values.contactPersonDesignation,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
      };
      if (values.postalCode) dto.postalCode = values.postalCode;
      onSubmit(dto);
    },
  });

  /** Shared error resolver — only show an error once the field is touched. */
  const fieldError = (name: keyof SchoolFormValues): string | undefined =>
    formik.touched[name] ? formik.errors[name] : undefined;

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
        <FormField
          id="schoolCode"
          name="schoolCode"
          label="School / Institution Code"
          value={formik.values.schoolCode}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={fieldError('schoolCode')}
          disabled={mode === 'edit'}
          required
        />

        <FormField
          id="registrationNo"
          name="registrationNo"
          label="Registration / Affiliation No."
          value={formik.values.registrationNo}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={fieldError('registrationNo')}
          required
        />

        <FormField
          id="schoolName"
          name="schoolName"
          label="School / Institution Name"
          containerClassName="md:col-span-2"
          value={formik.values.schoolName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={fieldError('schoolName')}
          required
        />

        <SelectField
          id="institutionType"
          name="institutionType"
          label="Institution Type"
          placeholder="Select institution type"
          options={INSTITUTION_TYPE_OPTIONS}
          value={formik.values.institutionType}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={fieldError('institutionType')}
          required
        />

        <SelectField
          id="schoolLevel"
          name="schoolLevel"
          label="School Level"
          placeholder="Select level"
          options={SCHOOL_LEVEL_OPTIONS}
          value={formik.values.schoolLevel}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={fieldError('schoolLevel')}
          required
        />

        <SelectField
          id="category"
          name="category"
          label="Category"
          placeholder="Select category"
          options={CATEGORY_OPTIONS}
          value={formik.values.category}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={fieldError('category')}
          required
        />

        <SelectField
          id="province"
          name="province"
          label="Province / Region"
          placeholder="Select province / region"
          options={PROVINCE_OPTIONS}
          value={formik.values.province}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={fieldError('province')}
          required
        />

        <FormField
          id="address"
          name="address"
          label="Address"
          containerClassName="md:col-span-2"
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
          id="postalCode"
          name="postalCode"
          label="Postal Code (optional)"
          inputMode="numeric"
          value={formik.values.postalCode}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={fieldError('postalCode')}
        />

        <FormField
          id="contactPersonName"
          name="contactPersonName"
          label="Contact Person Name"
          value={formik.values.contactPersonName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
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
          error={fieldError('contactPhone')}
          required
        />
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === 'create' ? 'Create School' : 'Save Changes'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default SchoolForm;
