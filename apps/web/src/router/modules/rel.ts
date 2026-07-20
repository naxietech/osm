/**
 * Turn an absolute path from ROUTES into the relative child segment it must be
 * declared as, given its role's home path. Deriving it (rather than hand-writing
 * the segment) keeps the route tree and ROUTES from drifting apart.
 */
export const rel = (home: string, full: string): string => full.slice(home.length + 1);
