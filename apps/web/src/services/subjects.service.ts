/**
 * Subjects API — the national subject/course list. Live against the backend.
 *
 * Every route here requires the `subjects.manage` grant, which only Super Admin holds, so a
 * 403 from any of them means the caller shouldn't have reached the screen at all.
 *
 * There is no delete: a subject is deactivated, never removed, so the curriculum, SLOs and
 * exams that reference one keep resolving to something real.
 *
 * NOTE: `academic.service.ts` still exports a mock `subjects` array that six other screens
 * read. That array is NOT this list and does not track it — see the comment there.
 */
import type { Subject } from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

const { subjects } = API_ENDPOINTS;

export interface CreateSubjectInput {
  code: string;
  name: string;
}

/** Send whichever field changed. Sending neither is a 400 — the API says so. */
export interface UpdateSubjectInput {
  code?: string;
  name?: string;
}

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

function getSubject(id: string): Promise<Subject> {
  return apiRequest<Subject>(subjects.detail(id));
}

/** Create a subject. A duplicate code — case-insensitively — comes back as a 409. */
function createSubject(input: CreateSubjectInput): Promise<Subject> {
  return apiRequest<Subject>(subjects.create, { method: 'POST', body: input });
}

/** Rename a subject or change its code. Moving onto a taken code is a 409. */
function updateSubject(id: string, input: UpdateSubjectInput): Promise<Subject> {
  return apiRequest<Subject>(subjects.detail(id), { method: 'PATCH', body: input });
}

/** An explicit target state rather than a toggle, so a double click cannot flip it back. */
function setSubjectStatus(id: string, isActive: boolean): Promise<Subject> {
  return apiRequest<Subject>(subjects.status(id), { method: 'PATCH', body: { isActive } });
}

export const subjectsService = {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  setSubjectStatus,
};
