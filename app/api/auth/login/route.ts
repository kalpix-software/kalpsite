import { NextRequest, NextResponse } from 'next/server';
import { loginWithGameAuth, gameRpc } from '@/lib/nakama';
import { AUTH_COOKIE_NAME, authCookieOptions, validateOrigin } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Map game backend auth errors to user-facing messages. */
function authErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not verified|verify your email|register.*OTP/i.test(msg)) {
    return 'Account not verified. Complete registration: register with email, then verify using the OTP sent to your inbox.';
  }
  if (/invalid|incorrect password|not found|not registered/i.test(msg)) {
    return 'Invalid email or password.';
  }
  return msg || 'Login failed.';
}

/**
 * Admin login: email + password must match .env. On match, authenticate via game backend
 * (auth/login_email RPC, same as Plazy/Postman), set is_admin if needed, set session cookie.
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateOrigin(req)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: NO_STORE });
    }

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
      const { token } = await loginWithGameAuth(email, password);
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
        // Non-fatal: admin metadata may already be set
      }

      const res = NextResponse.json({ success: true, user: { email } }, { headers: NO_STORE });
      res.cookies.set(AUTH_COOKIE_NAME, sessionToken, authCookieOptions);
      return res;
    } catch (e) {
      const message = authErrorMessage(e);
      const needRegister = /not verified|verify your email|register.*OTP/i.test(
        e instanceof Error ? e.message : String(e)
      );
      return NextResponse.json(
        needRegister ? { needRegister: true, error: message } : { error: message },
        { status: needRegister ? 200 : 401, headers: NO_STORE }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Login failed' },
      { status: 500, headers: NO_STORE }
    );
  }
}
