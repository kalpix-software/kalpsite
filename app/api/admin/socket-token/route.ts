import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Returns the game session token for the current admin so the client can
 * connect to the Nakama socket (for real-time chat: stream + notifications).
 * Only returns the token if the auth cookie is present.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
  }
  return NextResponse.json({ token }, { headers: NO_STORE });
}
