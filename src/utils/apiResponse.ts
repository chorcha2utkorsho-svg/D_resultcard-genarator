export type ApiResponseKind = 'ok' | 'auth_redirect' | 'static_host_html' | 'http_error';

export interface ParsedApiResult<T = any> {
  ok: boolean;
  status: number;
  authRedirected: boolean;
  staticHostNoBackend: boolean;
  responseKind: ApiResponseKind;
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
    if (res.redirected) {
      return true;
    }
  }
  return false;
}

/**
 * Strictly validates that an API response came from Express JSON backend rather than a
 * proxy HTML redirect or static SPA rewrite (index.html without Node backend).
 */
export async function parseJsonApiResponse<T = any>(res: Response): Promise<ParsedApiResult<T>> {
  const url = (res.url || '').toLowerCase();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  if (url.includes('__cookie_check') || url.includes('accounts.google.com')) {
    return {
      ok: false,
      status: res.status || 401,
      authRedirected: true,
      staticHostNoBackend: false,
      responseKind: 'auth_redirect',
      data: null,
      error: 'সেশন ভেরিফিকেশন প্রয়োজন (Proxy Auth Redirect)',
    };
  }

  if (!contentType.includes('application/json')) {
    let snippet = '';
    try {
      snippet = (await res.clone().text()).slice(0, 1500).toLowerCase();
    } catch {
      snippet = '';
    }

    const looksLikeProxyAuth =
      res.redirected ||
      snippet.includes('__cookie_check') ||
      snippet.includes('accounts.google.com') ||
      snippet.includes('servicelogin') ||
      snippet.includes('ai studio');

    const looksLikeSpaShell =
      snippet.includes('<!doctype html') ||
      snippet.includes('<div id="root"') ||
      snippet.includes('<script type="module"');

    if (!looksLikeProxyAuth && (looksLikeSpaShell || (contentType.includes('text/html') && res.status === 200))) {
      return {
        ok: false,
        status: res.status || 404,
        authRedirected: false,
        staticHostNoBackend: true,
        responseKind: 'static_host_html',
        data: null,
        error: 'এই হোস্টিংয়ে ব্যাকএন্ড সার্ভার (server.ts) চালু নেই — কেবল স্ট্যাটিক HTML পাওয়া গেছে',
      };
    }

    if (looksLikeProxyAuth || contentType.includes('text/html') || res.status === 200) {
      return {
        ok: false,
        status: res.status || 401,
        authRedirected: true,
        staticHostNoBackend: false,
        responseKind: 'auth_redirect',
        data: null,
        error: 'সেশন ভেরিফিকেশন প্রয়োজন (Proxy HTML Redirect)',
      };
    }
  }

  let parsed: T | null = null;
  try {
    parsed = (await res.json()) as T;
  } catch (err: any) {
    return {
      ok: false,
      status: res.status,
      authRedirected: false,
      staticHostNoBackend: false,
      responseKind: 'http_error',
      data: null,
      error: String(err?.message || 'Invalid JSON response'),
    };
  }

  return {
    ok: res.ok,
    status: res.status,
    authRedirected: false,
    staticHostNoBackend: false,
    responseKind: res.ok ? 'ok' : 'http_error',
    data: parsed,
    error: res.ok ? null : (parsed as any)?.message || `HTTP ${res.status}`,
  };
}
