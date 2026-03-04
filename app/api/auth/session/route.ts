import { NextRequest, NextResponse } from 'next/server';
import { gameRpc } from '@/lib/nakama';
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Returns 200 with { authenticated: true | false }. Validates the cookie token by calling
 * an auth-required RPC (same token format as login), so custom game JWTs are accepted.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  }
  try {
    await gameRpc(token, 'auth/ensure_admin_metadata', '{}');
    return NextResponse.json({ authenticated: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  }
}

export const dynamic = 'force-dynamic';
