// Browser-side fetch helper. Adds the header the server requires on changes,
// and sends the person to the sign-in page if their session has ended.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: { method?: string; json?: unknown; body?: BodyInit } = {}): Promise<T> {
  const method = init.method ?? (init.json !== undefined || init.body ? 'POST' : 'GET');
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['x-studio'] = '1';
  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, { method, headers, body, cache: 'no-store', credentials: 'same-origin' });
  if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/invite')) {
    window.location.href = '/login';
    throw new ApiError(401, 'Please sign in.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong.');
  return data as T;
}
