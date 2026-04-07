import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

const NAKAMA_URL = (process.env.NAKAMA_URL || 'http://localhost').replace(/\/$/, '');

/**
 * Admin file upload proxy: receives multipart/form-data from the browser and forwards
 * it to the backend's /api/v1/admin/upload endpoint (server-side R2 upload).
 * This sidesteps the R2 custom-domain presigned-URL limitation.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
  }

  try {
    const formData = await req.formData();

    // Forward the multipart form directly to the backend
    const res = await fetch(`${NAKAMA_URL}/api/v1/admin/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type — let fetch set it with the correct multipart boundary
      },
      body: formData,
    });

    const data = await res.json().catch(() => ({ error: 'Upload failed' }));
    return NextResponse.json(data, { status: res.status, headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
