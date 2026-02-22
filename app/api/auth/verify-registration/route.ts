import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify OTP after first-time admin registration and set game session cookie.
 * Calls game RPC auth/verify_registration_otp (unauthenticated).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.trim()?.toLowerCase();
    const otp = body.otp?.trim();
    const registrationId = body.registrationId?.trim();
    if (!email || !otp || !registrationId) {
      return NextResponse.json(
        { error: 'Email, OTP and registrationId required' },
        { status: 400 }
      );
    }

    const nakamaUrl = process.env.NAKAMA_URL;
    const serverKey = process.env.NAKAMA_SERVER_KEY || 'defaultkey';
    if (!nakamaUrl) {
      return NextResponse.json({ error: 'NAKAMA_URL not configured' }, { status: 503 });
    }

    const baseUrl = nakamaUrl.replace(/\/$/, '');
    const basicAuth = Buffer.from(`${serverKey}:`).toString('base64');
    const payload = JSON.stringify({ email, otp, registrationId });

    const rpcRes = await fetch(`${baseUrl}/v2/rpc/auth/verify_registration_otp?unwrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: payload,
    });

    if (!rpcRes.ok) {
      const errData = await rpcRes.json().catch(() => ({}));
      const msg =
        (errData as { error?: string }).error ??
        (errData as { message?: string }).message ??
        `Verification failed (${rpcRes.status})`;
      return NextResponse.json({ error: msg }, { status: rpcRes.status });
    }

    const data = await rpcRes.json();
    const token = (data as { sessionToken?: string }).sessionToken;
    if (!token) {
      return NextResponse.json(
        { error: 'Verification succeeded but no session token returned' },
        { status: 502 }
      );
    }

    const res = NextResponse.json({ success: true, user: { email } });
    res.cookies.set('nakama_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
