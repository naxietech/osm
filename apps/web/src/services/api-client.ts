/**
 * Typed HTTP client for the real backend. Attaches the auth token, normalizes
 * errors into ApiError, and (optionally) validates the response with a zod schema.
 * The mock authService doesn't use this yet — it's the transport layer real
 * services will call (e.g. `apiRequest('/students', { schema: studentsSchema })`).
 */
import type { z } from 'zod';

import { API_BASE_URL } from '@/lib/constants';

const AUTH_STORAGE_KEY = 'oses-auth';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    /* ignore */
  }
  return null;
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Optional zod schema to validate + narrow the response. */
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { method = 'GET', body, schema, signal } = options;
  const token = getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(res.status, message);
  }

  const data: unknown = res.status === 204 ? undefined : await res.json();
  return schema ? schema.parse(data) : (data as T);
}
