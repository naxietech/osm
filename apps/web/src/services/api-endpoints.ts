/**
 * Every backend path the web app calls, in one place — the request-side counterpart to
 * `router/routes.ts`. Paths are relative to `VITE_API_BASE_URL` (which already carries
 * the `/api/v1` prefix), and are passed to `apiRequest` from `api-client.ts`.
 *
 * Never inline a path string at a call site: a renamed endpoint should be a one-line
 * change here, and `api-client` matches on these same constants to decide which requests
 * may trigger a session renewal.
 *
 * Auth, users, roles, institutes and institute categories are the modules the API serves
 * today. Every other module is still a mock service, so nothing else belongs here yet.
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
  institutes: {
    list: '/institutes',
    create: '/institutes',
    get: (id: string) => `/institutes/${id}`,
    update: (id: string) => `/institutes/${id}`,
    remove: (id: string) => `/institutes/${id}`,
    approve: (id: string) => `/institutes/${id}/approve`,
    reject: (id: string) => `/institutes/${id}/reject`,
    status: (id: string) => `/institutes/${id}/status`,
  },
  instituteCategories: {
    list: '/institute-categories',
    create: '/institute-categories',
    get: (id: string) => `/institute-categories/${id}`,
    update: (id: string) => `/institute-categories/${id}`,
    remove: (id: string) => `/institute-categories/${id}`,
    status: (id: string) => `/institute-categories/${id}/status`,
  },
  /**
   * No credentials, and none should ever be sent. These back the open registration link, so a
   * 401 from any of them is a bug in the request, not an expired session — `api-client` must
   * not try to renew on their behalf.
   */
  public: {
    instituteCategories: '/public/institute-categories',
    registerInstitute: '/public/institutes',
    checkAvailability: '/public/institutes/check-availability',
  },
} as const;
