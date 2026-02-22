/**
 * Central config for admin session cookie. Used by login (set), logout (clear), and session (read).
 * Same options everywhere so the cookie is set and cleared correctly.
 */
export const AUTH_COOKIE_NAME = 'nakama_session';

const MAX_AGE_DAYS = 7;

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * MAX_AGE_DAYS,
  path: '/',
};
