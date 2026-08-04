/**
 * Classes API — the Class → Group → Subgroup hierarchy. Live against the backend.
 *
 * Every route requires the `levels.manage` grant, which only Super Admin holds, so a 403 from
 * any of them means the caller shouldn't have reached the screen at all.
 *
 * **There is no delete.** A class is deactivated with `setStatus`, and a group is deactivated by
 * leaving it out of a saved tree — student and exam records will point at these ids.
 */
import type { AcademicClass, CreateClassDto, UpdateClassDto } from '@oses/types';

import { apiRequest } from './api-client';
import { API_ENDPOINTS } from './api-endpoints';

const { classes } = API_ENDPOINTS;

/**
 * Every class in progression order, each with its full group tree — so opening the edit form
 * costs no second request.
 *
 * `activeOnly` is for pickers. The management screen wants everything, deactivated classes
 * included, or a class could never be switched back on.
 */
function listClasses(activeOnly = false): Promise<AcademicClass[]> {
  return apiRequest<AcademicClass[]>(activeOnly ? `${classes.list}?activeOnly=true` : classes.list);
}

function getClass(id: string): Promise<AcademicClass> {
  return apiRequest<AcademicClass>(classes.detail(id));
}

/** Create a class, optionally with its whole tree. A duplicate name comes back as a 409. */
function createClass(dto: CreateClassDto): Promise<AcademicClass> {
  return apiRequest<AcademicClass>(classes.create, { method: 'POST', body: dto });
}

/**
 * Update a class and its tree in one call, so a Save either fully happens or fully doesn't.
 *
 * `version` is the copy that was loaded; the API refuses the save if someone else got there
 * first, rather than letting this write silently undo theirs. **Omitting `groups` leaves the
 * stored tree alone** — sending it replaces the tree, deactivating anything left out.
 */
function updateClass(id: string, dto: UpdateClassDto): Promise<AcademicClass> {
  return apiRequest<AcademicClass>(classes.detail(id), { method: 'PATCH', body: dto });
}

/** Deactivate or restore a class. An explicit target state, so a double click is harmless. */
function setStatus(id: string, isActive: boolean): Promise<AcademicClass> {
  return apiRequest<AcademicClass>(classes.status(id), {
    method: 'PATCH',
    body: { isActive },
  });
}

export const classesService = { listClasses, getClass, createClass, updateClass, setStatus };
