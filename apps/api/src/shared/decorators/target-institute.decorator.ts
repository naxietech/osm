import { SetMetadata } from '@nestjs/common';

export const TARGET_INSTITUTE_KEY = 'target_institute_path';

/** Where the target institute id lives on the request. */
export type TargetInstitutePath = `params.${string}` | `query.${string}` | `body.${string}`;

/**
 * Declares where the target institute id can be read from the request (e.g.
 * `'params.instituteId'`). PermissionsGuard uses it to enforce `own-institute` scope
 * centrally for request-level routes: an institute-bound caller is rejected if the target
 * institute doesn't match their own. For routes where the institute is only known after
 * loading a record, use `assertOwnInstitute()` in the service instead.
 */
export const TargetInstitute = (path: TargetInstitutePath): ReturnType<typeof SetMetadata> =>
  SetMetadata(TARGET_INSTITUTE_KEY, path);
