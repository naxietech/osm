import type { Subject } from '@oses/types';

import type { SubjectRecord } from './ports';

/**
 * Every field that leaves the API is named here, one by one. The database row is never spread or
 * returned directly — so a column added later (an internal note, a client id, an audit counter)
 * cannot reach a client unless somebody deliberately adds it to this list.
 *
 * `creditHours` is part of the shared `Subject` type but has no column yet, so it is simply
 * absent rather than reported as `0` — a made-up zero would look like a real answer.
 */
export function toSubject(record: SubjectRecord): Subject {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    isActive: record.isActive,
  };
}
