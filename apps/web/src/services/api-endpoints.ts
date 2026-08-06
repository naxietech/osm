/**
 * Every backend path the web app calls, in one place — the request-side counterpart to
 * `router/routes.ts`. Paths are relative to `VITE_API_BASE_URL` (which already carries
 * the `/api/v1` prefix), and are passed to `apiRequest` from `api-client.ts`.
 *
 * Never inline a path string at a call site: a renamed endpoint should be a one-line
 * change here, and `api-client` matches on these same constants to decide which requests
 * may trigger a session renewal.
 *
 * Auth, users, roles and classes are the only modules the API serves today. Every other
 * module is still a mock service, so nothing else belongs here yet.
 */
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
    permissions: '/auth/permissions',
    changePassword: '/auth/password/change',
  },
  users: {
    list: '/users',
    create: '/users',
    get: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    remove: (id: string) => `/users/${id}`,
    resetPassword: (id: string) => `/users/${id}/reset-password`,
    status: (id: string) => `/users/${id}/status`,
  },
  roles: {
    list: '/roles',
  },
  classes: {
    list: '/classes',
    create: '/classes',
    /** Also the update path — one call saves the class and its whole group tree. */
    detail: (id: string) => `/classes/${id}`,
    status: (id: string) => `/classes/${id}/status`,
  },
} as const;
