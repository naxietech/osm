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
  GenderCategory,
  InstituteLevel,
  InstitutionType,
  Province,
} from '@oses/types';

import { Button } from '@/design-system/atoms/button';
import { Building2, type LucideIcon, MapPin, User } from '@/design-system/atoms/icon';
import { FormField } from '@/design-system/molecules/form-field';
import { SelectField, type SelectOption } from '@/design-system/molecules/select-field';

export interface InstituteFormProps {
  initialValues?: Partial<CreateInstituteDto>;
  onSubmit: (data: CreateInstituteDto) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

/** All-string shape used by the form controls; cast to CreateInstituteDto on submit. */
interface InstituteFormValues {
  instituteCode: string;
  instituteName: string;
  registrationNo: string;
  institutionType: string;
  instituteLevel: string;
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

const INSTITUTE_LEVEL_OPTIONS: SelectOption[] = [
  { value: InstituteLevel.SECONDARY, label: 'Secondary (SSC / Matric)' },
  { value: InstituteLevel.HIGHER_SECONDARY, label: 'Higher Secondary (HSSC / Intermediate)' },
  { value: InstituteLevel.BOTH, label: 'Both' },
];

const CATEGORY_OPTIONS: SelectOption[] = [
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
  registrationNo: Yup.string()
    .trim()
    .min(2, 'Registration number is too short')
    .max(50, 'Registration number is too long')
    .required('Registration / affiliation number is required'),
  institutionType: Yup.string()
    .oneOf(Object.values(InstitutionType), 'Select an institution type')
    .required('Institution type is required'),
  instituteLevel: Yup.string()
    .oneOf(Object.values(InstituteLevel), 'Select an institute level')
    .required('Institute level is required'),
  category: Yup.string()
    .oneOf(Object.values(GenderCategory), 'Select a category')
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
      registrationNo: initialValues?.registrationNo ?? '',
      institutionType: initialValues?.institutionType ?? '',
      instituteLevel: initialValues?.instituteLevel ?? '',
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
      const dto: CreateInstituteDto = {
        instituteCode: values.instituteCode,
        instituteName: values.instituteName,
        registrationNo: values.registrationNo,
        institutionType: values.institutionType as InstitutionType,
        instituteLevel: values.instituteLevel as InstituteLevel,
        category: values.category as GenderCategory,
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
  const fieldError = (name: keyof InstituteFormValues): string | undefined =>
    formik.touched[name] ? formik.errors[name] : undefined;

  /** Wires the custom SelectField (value + onChange/onBlur/error) to Formik. */
  const selectProps = (
    name: keyof InstituteFormValues,
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

          <SelectField
            id="institutionType"
            name="institutionType"
            label="Institution Type"
            options={INSTITUTION_TYPE_OPTIONS}
            required
            {...selectProps('institutionType')}
          />

          <SelectField
            id="instituteLevel"
            name="instituteLevel"
            label="Institute Level"
            options={INSTITUTE_LEVEL_OPTIONS}
            required
            {...selectProps('instituteLevel')}
          />

          <SelectField
            id="category"
            name="category"
            label="Category"
            options={CATEGORY_OPTIONS}
            required
            {...selectProps('category')}
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
            containerClassName="md:col-span-2 lg:col-span-3"
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
      </section>

      <div className="flex gap-3 border-t border-border pt-6">
        <Button type="submit" size="lg" isLoading={isSubmitting}>
          {mode === 'create' ? 'Create Institute' : 'Save Changes'}
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

export default InstituteForm;
