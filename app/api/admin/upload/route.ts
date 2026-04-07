import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie';
import { gameRpc } from '@/lib/nakama';

// Raise Vercel function limits for large Spine asset uploads.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? '';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

const allowedContentTypes: Record<string, string> = {
  'application/json': '.json',
  'text/plain': '.txt',
  'image/webp': '.webp',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
};

const allowedItemTypes = new Set([
  'avatar_spine', 'avatar_preview', 'avatar_thumbnail', 'game_item', 'chat_item',
]);

function sanitize(s: string) {
  return s.replace(/[^a-zA-Z0-9\-_]/g, '');
}
function sanitizeFileName(s: string) {
  return s.replace(/[^a-zA-Z0-9\-_.]/g, '');
}

function buildKey(itemType: string, category: string, subcategory: string, fileName: string, ext: string): string {
  const cat = sanitize(category) || 'general';
  const sub = sanitize(subcategory);
  const fn = sanitizeFileName(fileName);
  switch (itemType) {
    case 'avatar_spine':
      return `avatars/${cat}/spine/${fn}`;
    case 'avatar_thumbnail':
      return `avatars/${cat}/thumbnail.webp`;
    case 'avatar_preview': {
      if (!fn) return `avatars/${cat}/previews/${sub}/${Date.now()}${ext}`;
      const low = fn.toLowerCase();
      const base = low.endsWith(ext) ? fn : fn.replace(/\.[^.]+$/, '') + ext;
      return `avatars/${cat}/previews/${sub}/${base}`;
    }
    case 'game_item':
      return `games/${cat}/items/${sub}/${Date.now()}${ext}`;
    case 'chat_item':
      return `chat/items/${sub}/${Date.now()}${ext}`;
    default:
      return `uploads/${Date.now()}${ext}`;
  }
}

/**
 * Admin file upload: receives multipart/form-data from the browser, uploads directly
 * to R2 from Vercel (server-side). No droplet involved — browser → Vercel → R2.
 *
 * Fields: itemType, category, subcategory, fileName, file
 * Returns: { publicUrl, key }
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
  }

  // Verify the session is valid and the user is admin by calling the backend.
  try {
    await gameRpc(token, 'social/get_profile_info', '{}');
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401, headers: NO_STORE });
  }

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return NextResponse.json({ error: 'R2 not configured on server' }, { status: 500, headers: NO_STORE });
  }

  try {
    const formData = await req.formData();
    const itemType = (formData.get('itemType') as string) ?? '';
    const category = (formData.get('category') as string) ?? '';
    const subcategory = (formData.get('subcategory') as string) ?? '';
    const fileName = (formData.get('fileName') as string) ?? '';
    const fileEntry = formData.get('file');

    if (!allowedItemTypes.has(itemType)) {
      return NextResponse.json({ error: 'Invalid itemType' }, { status: 400, headers: NO_STORE });
    }
    if (itemType === 'avatar_spine' && !fileName) {
      return NextResponse.json({ error: 'fileName required for avatar_spine' }, { status: 400, headers: NO_STORE });
    }
    if (!(fileEntry instanceof Blob)) {
      return NextResponse.json({ error: 'file field required' }, { status: 400, headers: NO_STORE });
    }

    // Determine content type
    let ct = fileEntry.type || '';
    if (ct.includes(';')) ct = ct.split(';')[0].trim();
    if (!allowedContentTypes[ct]) {
      return NextResponse.json({ error: `Content type "${ct}" not allowed` }, { status: 400, headers: NO_STORE });
    }

    const ext = allowedContentTypes[ct];
    const key = buildKey(itemType, category, subcategory, fileName, ext);
    const data = Buffer.from(await fileEntry.arrayBuffer());

    // Upload directly to R2 using internal endpoint (no CORS issues — server-side)
    const r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: data,
      ContentType: ct,
    }));

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return NextResponse.json({ success: true, publicUrl, key }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    console.error('[admin/upload] error:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
