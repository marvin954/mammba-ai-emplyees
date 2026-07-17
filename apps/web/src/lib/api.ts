const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface RequestOptions extends RequestInit {
  token?: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' })) as { message?: string };
    throw new Error(error.message ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('nexusos_token');
}

export function setToken(token: string): void {
  localStorage.setItem('nexusos_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('nexusos_token');
  localStorage.removeItem('nexusos_org');
}
