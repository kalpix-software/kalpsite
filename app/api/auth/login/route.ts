import { NextRequest, NextResponse } from 'next/server';
import { authenticateEmail, gameRpc } from '@/lib/nakama';
import { AUTH_COOKIE_NAME, authCookieOptions } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Admin login: email + password must match .env. On match, authenticate with game server,
 * set is_admin if needed, set session cookie, return success. No match → 401. Game auth fail → needRegister.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.trim();
    const password = body.password;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400, headers: NO_STORE });
    }

    const adminEmail = process.env.KALPSITE_ADMIN_EMAIL;
    const adminPassword = process.env.KALPSITE_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Admin not configured (KALPSITE_ADMIN_EMAIL, KALPSITE_ADMIN_PASSWORD)' },
        { status: 503, headers: NO_STORE }
      );
    }
    if (email !== adminEmail || password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: NO_STORE });
    }

    try {
      const { token } = await authenticateEmail(email, password);
      const sessionToken = token?.trim();
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Game server did not return a session token' },
          { status: 502, headers: NO_STORE }
        );
      }

      try {
        await gameRpc(sessionToken, 'auth/ensure_admin_metadata', '{}');
      } catch {
        // Non-fatal
      }

      const res = NextResponse.json({ success: true, user: { email } }, { headers: NO_STORE });
      res.cookies.set(AUTH_COOKIE_NAME, sessionToken, authCookieOptions);
      return res;
    } catch {
      return NextResponse.json(
        { needRegister: true, error: 'Account not verified. Register to receive an OTP, then verify.' },
        { status: 200, headers: NO_STORE }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Login failed' },
      { status: 500, headers: NO_STORE }
    );
  }
}
