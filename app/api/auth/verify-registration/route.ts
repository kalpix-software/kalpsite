import { NextRequest, NextResponse } from 'next/server';
import { serverRpc } from '@/lib/nakama';
import { AUTH_COOKIE_NAME, authCookieOptions, validateOrigin } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Verify OTP after first-time admin registration and set game session cookie.
 * Uses serverRpc (Nginx adds http_key) so no http_key is used on this server.
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateOrigin(req)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: NO_STORE });
    }
    const body = await req.json();
    const email = body.email?.trim()?.toLowerCase();
    const otp = body.otp?.trim();
    const registrationId = body.registrationId?.trim();
    if (!email || !otp || !registrationId) {
      return NextResponse.json(
        { error: 'Email, OTP and registrationId required' },
        { status: 400, headers: NO_STORE }
      );
    }

    const result = await serverRpc('auth/verify_registration_otp', {
      email,
      otp,
      registrationId,
    });

    const data = result as { sessionToken?: string };
    const token = data?.sessionToken;
    if (!token) {
      return NextResponse.json(
        { error: 'Verification succeeded but no session token returned' },
        { status: 502, headers: NO_STORE }
      );
    }

    const res = NextResponse.json({ success: true, user: { email } }, { headers: NO_STORE });
    res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions);
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500, headers: NO_STORE }
    );
  }
}
