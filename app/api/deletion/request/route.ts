import { NextRequest, NextResponse } from 'next/server'
import { publicRpc } from '@/lib/kalpix-api'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Public proxy for the web account-deletion REQUEST step. Takes an email and
 * asks the backend to send a one-time confirm link to it. The backend always
 * returns the same neutral message whether or not the email is registered, so
 * this never reveals which addresses have accounts.
 */
export async function POST(req: NextRequest) {
  let email = ''
  try {
    const body = await req.json()
    email = typeof body?.email === 'string' ? body.email : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: NO_STORE })
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400, headers: NO_STORE })
  }
  try {
    await publicRpc('auth/request_web_deletion', JSON.stringify({ email }))
    // Always neutral: do not leak whether the email exists.
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch {
    // Even on a backend error, return the neutral success so failures cannot
    // be used to probe for registered emails.
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }
}
