import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getEnvironment } from '@/lib/environment';
import { AUTH_COOKIE_NAME, validateOrigin } from '@/lib/auth-cookie';
import { gameRpc } from '@/lib/kalpix-api';

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
  // Chat-shop font items (itemType=chat_item, subcategory=font). Browsers are
  // inconsistent about which of these they report for the same .ttf/.otf file.
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'font/woff': '.woff',
  'font/woff2': '.woff2',
  'application/font-woff': '.woff',
  'application/x-font-ttf': '.ttf',
  'application/x-font-otf': '.otf',
};

// Content type → extension for fonts identified by filename. Browsers often
// report a bare application/octet-stream for .ttf/.otf, so the extension is
// the only usable signal; we still whitelist it rather than trusting the name.
const fontExtToContentType: Record<string, string> = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const allowedItemTypes = new Set([
  'avatar_spine', 'avatar_preview', 'avatar_thumbnail', 'avatar_background', 'game_item', 'chat_item', 'card_deck',
  'game_icon', 'game_banner',
]);

function sanitize(s: string) {
  return s.replace(/[^a-zA-Z0-9\-_]/g, '');
}
function sanitizeFileName(s: string) {
  return s.replace(/[^a-zA-Z0-9\-_.]/g, '');
}

// Cache-Control written onto the R2 object itself. Cloudflare passes an origin
// Cache-Control straight through (verified: the bundle zips serve their own
// immutable header) and only applies its own 4h default when the origin sends
// nothing.
//
// A timestamped key can never denote different bytes, so it is cached forever and
// never purged — a replacement lands at a different url, which misses every cache
// at once. That is what makes new uploads appear immediately at zero cost.
//
// A deterministic key IS overwritten in place, so it keeps its url and has to be
// purged by hand from the Cloudflare dashboard (Caching > Configuration > Purge
// Cache) after a replacement. Rare, by design — only the families whose url the
// backend rebuilds from a slug land here: the Tero deck sheet+atlas, avatar Spine
// rigs, avatar thumbnails, chess piece sets.
//
// Those get a long EDGE ttl and a short BROWSER ttl, which is the whole point of
// the split: s-maxage keeps the object at the edge for a year so it costs nothing
// to serve, while max-age bounds how long an already-served client can ignore that
// purge. `immutable` must never appear here — it tells clients not to revalidate
// at all, and a purge cannot reach a client that never asks.
//
// NOTE: Cloudflare's "Browser Cache TTL" setting currently REWRITES max-age on
// responses it caches (observed: 3600 served back as 14400), so the browser half
// of this only takes effect once that setting is "Respect Existing Headers".
const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
const CACHE_REPLACEABLE = 'public, max-age=3600, s-maxage=31536000';

/**
 * The R2 key for this upload, plus whether that key is content-stable.
 * `immutable: true` means the key carries a timestamp, so a re-upload lands at a
 * NEW url and no cache anywhere can serve a stale copy. `false` means re-uploads
 * overwrite in place and the object needs a short revalidation window.
 */
function buildKey(
  itemType: string,
  category: string,
  subcategory: string,
  fileName: string,
  ext: string,
): { key: string; immutable: boolean } {
  const cat = sanitize(category) || 'general';
  const sub = sanitize(subcategory);
  const fn = sanitizeFileName(fileName);
  switch (itemType) {
    case 'avatar_spine':
      return { key: `avatars/${cat}/spine/${fn}`, immutable: false };
    case 'avatar_thumbnail':
      return { key: `avatars/${cat}/thumbnail.webp`, immutable: false };
    // Game icon / banner. Timestamped rather than deterministic: unlike the
    // avatar thumbnail, whose url the backend rebuilds from the slug, the game
    // row stores whatever url we return. A new url on every upload means a
    // re-upload is visible immediately with no cache purge — which is the whole
    // point of being able to change it from the admin panel.
    case 'game_icon':
      return { key: `games/${cat}/icon-${Date.now()}${ext}`, immutable: true };
    case 'game_banner':
      return { key: `games/${cat}/banner-${Date.now()}${ext}`, immutable: true };
    case 'avatar_preview': {
      if (!fn) return { key: `avatars/${cat}/previews/${sub}/${Date.now()}${ext}`, immutable: true };
      const low = fn.toLowerCase();
      const base = low.endsWith(ext) ? fn : fn.replace(/\.[^.]+$/, '') + ext;
      return { key: `avatars/${cat}/previews/${sub}/${base}`, immutable: false };
    }
    case 'avatar_background': {
      // Full-res background image (not spine-driven). Deterministic name (e.g. bg_1.webp) so it matches the catalog assetUrl.
      if (!fn) return { key: `avatars/${cat}/backgrounds/${sub}/${Date.now()}${ext}`, immutable: true };
      const low = fn.toLowerCase();
      const base = low.endsWith(ext) ? fn : fn.replace(/\.[^.]+$/, '') + ext;
      return { key: `avatars/${cat}/backgrounds/${sub}/${base}`, immutable: false };
    }
    case 'game_item':
      return { key: `games/${cat}/items/${sub}/${Date.now()}${ext}`, immutable: true };
    case 'chat_item':
      return { key: `chat/items/${sub}/${Date.now()}${ext}`, immutable: true };
    case 'card_deck':
      // Tero card-deck sprite atlas. category = variant slug (e.g. "space").
      // Deterministic names so the backend builds the URL from the slug alone:
      //   .txt  -> {variant}.atlas.txt   (per-card bounds)
      //   .webp -> {variant}.webp        (sprite sheet)
      // The URL is derived from the slug in Go, so there is nowhere to stamp a
      // version — the short revalidation window above is what makes a re-upload
      // reach players.
      return {
        key:
          ext === '.txt'
            ? `games/tero/card_decks/${cat}/${cat}.atlas.txt`
            : `games/tero/card_decks/${cat}/${cat}.webp`,
        immutable: false,
      };
    default:
      return { key: `uploads/${Date.now()}${ext}`, immutable: true };
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
  // CSRF defense-in-depth (matches /api/admin/rpc) on top of the SameSite=Strict
  // cookie — this route overwrites live game art at predictable keys.
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: NO_STORE });
  }
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
  }

  // Verify the session AND that it belongs to an admin. get_profile_info resolves
  // for ANY logged-in player, so the isAdmin check is what actually gates this —
  // without it a player could overwrite any deck/avatar asset at a known key.
  // Mirrors the check in /api/auth/session. The backend's own presign RPC
  // (store/admin_get_upload_url) gates with checkAdmin; this path is the twin.
  try {
    const profile = (await gameRpc(token, 'social/get_profile_info', '{}')) as { isAdmin?: boolean };
    if (profile?.isAdmin !== true) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: NO_STORE });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401, headers: NO_STORE });
  }

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return NextResponse.json({ error: 'R2 not configured on server' }, { status: 500, headers: NO_STORE });
  }

  // Refuse to write if the bucket does not belong to the backend we are
  // recording against. Without this an upload can succeed into one environment
  // while its database row is created in the other — no error at the time, and
  // an image that 404s for everyone later. Failing here is far cheaper.
  try {
    getEnvironment();
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: NO_STORE },
    );
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
    if (itemType === 'card_deck' && !category) {
      return NextResponse.json({ error: 'category (variant slug) required for card_deck' }, { status: 400, headers: NO_STORE });
    }
    if (!(fileEntry instanceof Blob)) {
      return NextResponse.json({ error: 'file field required' }, { status: 400, headers: NO_STORE });
    }

    // Determine content type
    let ct = fileEntry.type || '';
    if (ct.includes(';')) ct = ct.split(';')[0].trim();
    let ext = allowedContentTypes[ct];
    if (!ext) {
      // Fall back to the filename for fonts the browser typed as a generic
      // binary blob (or typed not at all) — otherwise a perfectly valid .ttf
      // is rejected with `Content type "application/octet-stream" not allowed`.
      const dot = fileName.lastIndexOf('.');
      const guess = dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
      const fontCt = fontExtToContentType[guess];
      if (fontCt && (ct === '' || ct === 'application/octet-stream')) {
        ext = guess;
        ct = fontCt;
      } else {
        return NextResponse.json({ error: `Content type "${ct}" not allowed` }, { status: 400, headers: NO_STORE });
      }
    }

    const { key, immutable } = buildKey(itemType, category, subcategory, fileName, ext);
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
      CacheControl: immutable ? CACHE_IMMUTABLE : CACHE_REPLACEABLE,
    }));

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return NextResponse.json({ success: true, publicUrl, key }, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    console.error('[admin/upload] error:', message);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
