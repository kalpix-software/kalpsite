import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, authCookieOptions } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST() {
  const res = NextResponse.json({ success: true }, { headers: NO_STORE });
  res.cookies.set(AUTH_COOKIE_NAME, '', {
    ...authCookieOptions,
    maxAge: 0,
  });
  return res;
}
