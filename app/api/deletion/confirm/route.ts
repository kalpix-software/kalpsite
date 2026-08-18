import { NextRequest, NextResponse } from 'next/server'
import { publicRpc } from '@/lib/kalpix-api'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Public proxy for the web account-deletion CONFIRM step. Takes the one-time
 * token from the emailed link and schedules the 14-day grace-period deletion.
 */
export async function POST(req: NextRequest) {
  let token = ''
  try {
    const body = await req.json()
    token = typeof body?.token === 'string' ? body.token : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE })
  }
  if (!token) {
    return NextResponse.json({ error: 'Missing confirmation token' }, { status: 400, headers: NO_STORE })
  }
  try {
    const result = await publicRpc('auth/confirm_web_deletion', JSON.stringify({ token }))
    return NextResponse.json({ ok: true, result }, { headers: NO_STORE })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'This link is invalid or has expired.'
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE })
  }
}
