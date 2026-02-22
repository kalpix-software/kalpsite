import { NextRequest, NextResponse } from 'next/server';
import { serverRpc } from '@/lib/nakama';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Start admin registration: email + password must match .env. Calls the existing
 * auth/register_email RPC with http_key (unauthenticated flow). Backend sends OTP and
 * returns registrationId. When the user verifies, backend sets is_admin if email matches ADMIN_EMAIL.
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

    const result = await serverRpc('auth/register_email', {
      email,
      password,
      username: email.split('@')[0] || 'admin',
      deviceId: 'kalpsite-admin',
      platform: 'web',
      deviceName: 'Kalpsite Admin',
    });

    const data = result as { message?: string; email?: string; registrationId?: string };
    const registrationId = data?.registrationId;
    if (!registrationId) {
      return NextResponse.json(
        { error: 'Server did not return a registration ID' },
        { status: 502, headers: NO_STORE }
      );
    }

    return NextResponse.json({
      message: data.message || 'OTP sent to your email.',
      email: data.email || email,
      registrationId,
    }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Register failed';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
