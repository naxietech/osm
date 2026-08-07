/**
 * Institutes API — registration, the approval queue, and the directory. Live against the backend.
 *
 * Two audiences, deliberately kept apart. Everything under `publicInstitutesService` takes no
 * credentials and is reachable from the open registration link; everything under
 * `institutesService` needs the `institutes.manage` grant, which only Super Admin holds.
 *
 * Two ways to switch an institute off, and they are not interchangeable. `setStatus` is the
 * reversible one and stays available once students and exams exist. `deleteInstitute` is refused
 * the moment anything hangs off the institute — it exists for the approved-by-mistake case, and
 * it frees the institute code for a correct entry.
 */
import type {
  ApproveInstituteDto,
  AvailabilityResult,
  CreateInstituteDto,
  Institute,
  InstituteDetail,
  InstituteStatus,
  PaginatedInstitutes,
  PublicInstituteCategory,
  RegisterInstituteDto,
  RegistrationReceipt,
  UpdateInstituteDto,
} from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

const { institutes, public: publicApi } = API_ENDPOINTS;

/** Rows per page. The API caps `limit` at 100 and rejects anything larger. */
export const INSTITUTES_PAGE_SIZE = 25;

export interface ListInstitutesParams {
  limit?: number;
  offset?: number;
  /** Free-text over name, institute code and city, case-insensitive. */
  q?: string;
  status?: InstituteStatus;
  categoryId?: string;
}

/**
 * Builds the query string, leaving out anything blank.
 *
 * Sending `status=` (empty) is not the same as sending nothing: the API validates the value
 * against a fixed set, so an empty one is a 400 rather than "no filter".
 */
function listQuery({
  limit = INSTITUTES_PAGE_SIZE,
  offset = 0,
  q,
  status,
  categoryId,
}: ListInstitutesParams): string {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q?.trim()) params.set('q', q.trim());
  if (status) params.set('status', status);
  if (categoryId) params.set('categoryId', categoryId);
  return params.toString();
}

/**
 * One page of institutes, newest first, plus the total so the UI can page through.
 *
 * `total` counts everything the filters match, not the page — the API narrows both with the
 * same set, so it is safe to drive "showing 1–25 of 132" from it.
 */
function listInstitutes(params: ListInstitutesParams = {}): Promise<PaginatedInstitutes> {
  return apiRequest<PaginatedInstitutes>(`${institutes.list}?${listQuery(params)}`);
}

/**
 * One institute, with its category answers and `possibleDuplicates` — live institutes sharing
 * this name and city. That list is a prompt for the approver to look twice, never a block: two
 * "Government High School" in different cities is entirely normal.
 */
function getInstitute(id: string): Promise<InstituteDetail> {
  return apiRequest<InstituteDetail>(institutes.get(id));
}

/**
 * A super admin entering an institute directly. It lands `approved` with its numeric code
 * already drawn — no login is created, because that is the Users screen's job.
 */
/**
 * Returns the same `{ institute, userId, message }` as approval, because that is literally what
 * it does: with a password the API registers the institute *and* its login in one action, taking
 * the ordinary approval path to get there. `userId` says whether an account was created, and the
 * message is the server's own wording for it — do not restate it here.
 */
function createInstitute(dto: CreateInstituteDto): Promise<ApprovalResponse> {
  return apiRequest<ApprovalResponse>(institutes.create, { method: 'POST', body: dto });
}

/**
 * Edit the fields that stay editable. Send only what changed — the API rejects an empty patch.
 *
 * The institute code, category, answers and numeric code are locked: sending one answers 400
 * naming the field rather than accepting the request and ignoring it. `contactEmail` is not
 * locked, but changing it does **not** change any login — that is a separate user account.
 */
function updateInstitute(id: string, dto: UpdateInstituteDto): Promise<Institute> {
  return apiRequest<Institute>(institutes.update(id), { method: 'PATCH', body: dto });
}

export interface ApprovalResponse {
  institute: Institute;
  /** The account created alongside the approval, or null when none was asked for. */
  userId: string | null;
  message: string;
}

/**
 * Approve & Register — one transaction: the status flips, the permanent numeric code is drawn,
 * the login is created and the stored password is destroyed. Any failure rolls back all four.
 *
 * Approving a second time answers 409 rather than minting a second account, so a double click
 * is safe. A 409 also covers the contact email having been taken since the application arrived.
 */
function approveInstitute(id: string, dto: ApproveInstituteDto): Promise<ApprovalResponse> {
  return apiRequest<ApprovalResponse>(institutes.approve(id), { method: 'POST', body: dto });
}

/**
 * Reject an application. The row stays with its reason as the record of who applied and was
 * turned away, but the institute code is freed so they can apply again once it is fixed.
 *
 * There is no email service: telling them is a phone call.
 */
function rejectInstitute(
  id: string,
  reason: string,
): Promise<{ institute: Institute; message: string }> {
  return apiRequest(institutes.reject(id), { method: 'POST', body: { reason } });
}

/**
 * Deactivate or reactivate. Deactivating switches off the institute's accounts and revokes their
 * sessions. Reactivating deliberately does **not** switch those accounts back on — one of them
 * may have been disabled for its own reasons.
 */
function setStatus(
  id: string,
  status: 'approved' | 'deactivated',
): Promise<{ institute: Institute; message: string }> {
  return apiRequest(institutes.status(id), { method: 'PATCH', body: { status } });
}

/**
 * Soft delete, and only while nothing is attached. The API refuses once any user, student or
 * exam hangs off the institute and says what is attached, so the message is worth showing as-is.
 */
function deleteInstitute(id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(institutes.remove(id), { method: 'DELETE' });
}

export const institutesService = {
  listInstitutes,
  getInstitute,
  createInstitute,
  updateInstitute,
  approveInstitute,
  rejectInstitute,
  setStatus,
  deleteInstitute,
};

// ---- the open registration link (no credentials) --------------------------------------

/** Active categories and their questions, so the public form can draw itself. */
/**
 * `PublicInstituteCategory`, not `InstituteCategory`. The public route returns only active
 * categories and omits `isActive` and `version` entirely — typing it as the admin shape let the
 * page filter on `isActive`, which is never sent, so every category was dropped and the
 * registration form showed an empty dropdown.
 */
function listPublicCategories(): Promise<PublicInstituteCategory[]> {
  return apiRequest<PublicInstituteCategory[]>(publicApi.instituteCategories);
}

/**
 * Whether a code and/or an email are free, for the check as the applicant moves between steps.
 *
 * POST rather than GET: an email in a query string lands in server logs and browser history.
 * A field not asked about answers `null` rather than a guess.
 */
function checkAvailability(body: {
  instituteCode?: string;
  contactEmail?: string;
}): Promise<AvailabilityResult> {
  return apiRequest<AvailabilityResult>(publicApi.checkAvailability, { method: 'POST', body });
}

/**
 * Submit a registration. Creates one pending application and nothing else — no login, no access
 * — until a super admin approves it.
 *
 * The response carries four fields, the institute code among them. That code is what the
 * applicant quotes when they phone to ask what happened, since nothing can be emailed to them.
 */
function registerInstitute(dto: RegisterInstituteDto): Promise<RegistrationReceipt> {
  return apiRequest<RegistrationReceipt>(publicApi.registerInstitute, {
    method: 'POST',
    body: dto,
  });
}

export const publicInstitutesService = {
  listPublicCategories,
  checkAvailability,
  registerInstitute,
};
