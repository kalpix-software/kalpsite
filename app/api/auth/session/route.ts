import { NextRequest, NextResponse } from 'next/server';
import { gameRpc } from '@/lib/kalpix-api';
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET: returns { authenticated: true | false }. Validates the session using
 * social/get_profile_info (same RPC Plazy uses). Token from cookie or Authorization header.
 */
export async function GET(req: NextRequest) {
  const token =
    req.cookies.get(AUTH_COOKIE_NAME)?.value ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  }
  try {
    const profile = (await gameRpc(token, 'social/get_profile_info', '{}')) as { isAdmin?: boolean };
    if (profile?.isAdmin === true) {
      return NextResponse.json({ authenticated: true }, { headers: NO_STORE });
    }
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  }
}

export const dynamic = 'force-dynamic';
