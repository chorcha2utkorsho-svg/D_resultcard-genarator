export interface ParsedApiResult<T = any> {
  ok: boolean;
  status: number;
  authRedirected: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Checks whether an HTTP response was intercepted by AI Studio IAP / cookie-check proxy
 * (which often responds HTTP 200 OK with text/html instead of application/json).
 */
export function isAuthRedirectResponse(res: Response): boolean {
  const url = (res.url || '').toLowerCase();
  if (url.includes('__cookie_check') || url.includes('accounts.google.com')) {
    return true;
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    if (res.redirected || contentType.includes('text/html') || res.status === 200) {
      return true;
    }
  }
  return false;
}

/**
 * Strictly validates that an API response came from Express JSON backend rather than a
 * proxy HTML redirect or service-worker shell.
 */
export async function parseJsonApiResponse<T = any>(res: Response): Promise<ParsedApiResult<T>> {
  if (isAuthRedirectResponse(res)) {
    return {
      ok: false,
      status: res.status || 401,
      authRedirected: true,
      data: null,
      error: 'সেশন ভেরিফিকেশন প্রয়োজন (Proxy HTML Redirect)',
    };
  }

  let parsed: T | null = null;
  try {
    parsed = (await res.json()) as T;
  } catch (err: any) {
    return {
      ok: false,
      status: res.status,
      authRedirected: false,
      data: null,
      error: String(err?.message || 'Invalid JSON response'),
    };
  }

  return {
    ok: res.ok,
    status: res.status,
    authRedirected: false,
    data: parsed,
    error: res.ok ? null : (parsed as any)?.message || `HTTP ${res.status}`,
  };
}
