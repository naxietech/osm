/**
 * Subjects API — the national subject/course list. Live against the backend.
 *
 * Every route here requires the `subjects.manage` grant, which only Super Admin holds, so a
 * 403 from any of them means the caller shouldn't have reached the screen at all.
 *
 * There is no delete: a subject is deactivated, never removed, so the curriculum, SLOs and
 * exams that reference one keep resolving to something real.
 *
 * NOTE: `academic.service.ts` still exports a mock `subjects` array that seven other screens
 * read. That array is NOT this list and does not track it — see the comment there.
 */
import type { CreateSubjectDto, Subject, UpdateSubjectDto } from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

const { subjects } = API_ENDPOINTS;

/**
 * Every subject, ordered by name, deactivated ones included.
 *
 * `activeOnly` is for pickers that must not offer a withdrawn subject. The management screen
 * wants the full list — hiding deactivated rows there would make them unrecoverable.
 */
function listSubjects(options: { activeOnly?: boolean } = {}): Promise<Subject[]> {
  const query = options.activeOnly ? '?activeOnly=true' : '';
  return apiRequest<Subject[]>(`${subjects.list}${query}`);
}

/** Create a subject. A duplicate code — case-insensitively — comes back as a 409. */
function createSubject(input: CreateSubjectDto): Promise<Subject> {
  return apiRequest<Subject>(subjects.create, { method: 'POST', body: input });
}

/**
 * Rename a subject or change its code. Send whichever field changed; sending neither is a 400.
 * Moving onto a taken code is a 409.
 */
function updateSubject(id: string, input: UpdateSubjectDto): Promise<Subject> {
  return apiRequest<Subject>(subjects.byId(id), { method: 'PATCH', body: input });
}

/** An explicit target state rather than a toggle, so a double click cannot flip it back. */
function setSubjectStatus(id: string, isActive: boolean): Promise<Subject> {
  return apiRequest<Subject>(subjects.status(id), { method: 'PATCH', body: { isActive } });
}

export const subjectsService = {
  listSubjects,
  createSubject,
  updateSubject,
  setSubjectStatus,
};
