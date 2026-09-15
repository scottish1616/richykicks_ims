/**
 * Thin fetch wrapper for talking to the FastAPI backend.
 *
 * Two cross-cutting behaviors live here so every page gets them for
 * free, without repeating logic in each component:
 *
 * 1. CSRF: the backend uses a double-submit-cookie pattern
 *    (app/core/csrf.py) - a JS-readable "csrf_token" cookie is set at
 *    login, and every mutating request must echo it back as an
 *    X-CSRF-Token header. Without this, every POST/PUT/PATCH/DELETE
 *    fails with 403 "CSRF token missing or invalid".
 * 2. Session expiry: a 401 outside of login/the silent initial auth
 *    check means the session expired mid-use - redirect to /login
 *    with a friendly banner instead of surfacing a raw error.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

// 401 from these is an expected, normal outcome the calling code
// already handles itself - never force-redirect for these.
const SESSION_CHECK_EXEMPT_PATHS = ["/api/auth/login", "/api/auth/me"];

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !SESSION_CHECK_EXEMPT_PATHS.includes(path)) {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login?expired=1";
    }
    // Redirect is already underway - stop here rather than throwing,
    // so the unmounting page doesn't flash an error first.
    return new Promise<T>(() => {});
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}