import { NextRequest, NextResponse } from 'next/server';
import { gameRpc } from '@/lib/nakama';
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie';

/**
 * Admin RPC: requires a valid game session cookie (set at Kalpsite login).
 * The session must be for a game user with is_admin in metadata; the backend enforces that.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  try {
    const { rpcId, payload } = await req.json();
    if (!rpcId || typeof rpcId !== 'string') {
      return NextResponse.json({ error: 'rpcId required' }, { status: 400 });
    }
    const body = typeof payload === 'string' ? (payload || '{}') : JSON.stringify(payload ?? '{}');
    const result = await gameRpc(token, rpcId, body);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'RPC failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
