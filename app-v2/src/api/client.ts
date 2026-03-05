import { QueryClient } from '@tanstack/react-query';

export const API_BASE = import.meta.env.VITE_API_BASE || '';
export const USE_STUBS = import.meta.env.VITE_USE_STUBS === 'true';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setAuthToken(null);
    window.dispatchEvent(new CustomEvent('sogojet:auth-expired'));
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch {
      // Response wasn't JSON — use statusText
    }

    if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
    if (res.status === 403) throw new Error('Access denied.');
    if (res.status >= 500) throw new Error(`Server error — please try again later.`);
    throw new Error(detail || `Request failed (${res.status})`);
  }

  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server');
  }
}
