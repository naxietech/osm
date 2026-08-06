import type { InstituteRecord } from './ports';

/**
 * What an anonymous caller is told after submitting a registration.
 *
 * Four fields, and that is the whole contract. There is no public read of an institute anywhere
 * in this module — the only thing the public routes ever return about a specific institute is
 * this acknowledgement of something the submitter just typed themselves.
 *
 * It lives in its own file, apart from {@link toAdminInstitute}, for the same reason the module
 * has two controllers: widening what the public sees should require editing a file whose entire
 * purpose is public output, not adding a line to a mapper that serves both audiences.
 */
export interface RegistrationReceipt {
  id: string;
  instituteCode: string;
  instituteName: string;
  status: 'pending';
}

export function toRegistrationReceipt(record: InstituteRecord): RegistrationReceipt {
  return {
    id: record.id,
    instituteCode: record.instituteCode,
    instituteName: record.instituteName,
    // Hard-coded, not read from the record. A public submission is pending by definition; if
    // that ever stopped being true this line would have to be changed deliberately.
    status: 'pending',
  };
}

/**
 * The availability answer. Two booleans and nothing else — never the institute that holds the
 * code, never whose account owns the email.
 */
export interface AvailabilityResult {
  codeAvailable: boolean | null;
  emailAvailable: boolean | null;
}
