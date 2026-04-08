/**
 * Central config for admin session cookie. Used by login (set), logout (clear), and session (read).
 * Same options everywhere so the cookie is set and cleared correctly.
 */
export const AUTH_COOKIE_NAME = 'kalpix_session';

const MAX_AGE_DAYS = 7;

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * MAX_AGE_DAYS,
  path: '/',
};

/** CSRF-like origin validation. Rejects cross-origin browser requests. */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return true; // Allow requests without origin (non-browser)
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}
