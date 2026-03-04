import { NextRequest, NextResponse } from 'next/server';
import { serverRpc } from '@/lib/nakama';
import { AUTH_COOKIE_NAME, authCookieOptions, validateOrigin } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Verify OTP for admin registration. Uses auth/verify_registration_otp via Nginx (no http_key).
 * Backend sets is_admin in metadata when email matches ADMIN_EMAIL.
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateOrigin(req)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: NO_STORE });
    }
    const body = await req.json();
    const email = body.email?.trim();
    const otp = body.otp?.trim();
    const registrationId = body.registrationId?.trim();
    if (!email || !otp || !registrationId) {
      return NextResponse.json(
        { error: 'Email, OTP, and registration ID are required' },
        { status: 400, headers: NO_STORE }
      );
    }

    const adminEmail = process.env.KALPSITE_ADMIN_EMAIL;
    if (adminEmail && email !== adminEmail) {
      return NextResponse.json({ error: 'Invalid email for admin verification' }, { status: 401, headers: NO_STORE });
    }

    const sessionInfo = await serverRpc('auth/verify_registration_otp', {
      email,
      otp,
      registrationId,
    });

    const sessionToken =
      (sessionInfo as { sessionToken?: string })?.sessionToken;
    const res = NextResponse.json({
      success: true,
      message: 'Verified. You are now logged in.',
    }, { headers: NO_STORE });
    if (sessionToken) {
      res.cookies.set(AUTH_COOKIE_NAME, sessionToken, authCookieOptions);
    }
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE });
  }
}
