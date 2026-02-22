import { NextRequest, NextResponse } from 'next/server';
import { validateGameSession } from '@/lib/nakama';
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Returns 200 with { authenticated: true | false }. Never 401 so client can always parse JSON.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  }
  try {
    const valid = await validateGameSession(token);
    return NextResponse.json({ authenticated: valid }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  }
}
