'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Send, RefreshCw, Trash2 } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

// Broadcasts are one-shot promotional pushes (offers/discounts) sent to every opted-in user.
// Composing here calls notifications/admin_broadcast, which creates the broadcast row and — when
// publishAt is null or in the past — fans it out as a push right away. A future publishAt queues
// it (Draft) for later delivery. The hero image is optional and is uploaded straight to R2 via the
// store presign flow. Past broadcasts are listed below and can be retracted.

// ─── Types ───

type CtaType = 'none' | 'route' | 'url';

// The compose form's local state (one broadcast being drafted).
type ComposeState = {
  title: string;
  body: string;
  imageUrl: string;
  ctaType: CtaType;
  ctaValue: string;
  audience: string;
  publishAt: number; // epoch seconds; 0 = send now
  expiresAt: number; // epoch seconds; 0 = never expires
};

// A past broadcast row (from notifications/admin_list_broadcasts).
type BroadcastRow = {
  broadcastId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  ctaType: string | null;
  ctaValue: string | null;
  audience: string;
  createdAt: number;
  publishAt: number | null;
  expiresAt: number | null;
  isDeleted: boolean;
  // UI-only flag
  deleting?: boolean;
};

// Shape returned by notifications/admin_list_broadcasts (only the bits we read).
type RawBroadcast = {
  broadcastId?: string; title?: string; body?: string; imageUrl?: string | null;
  ctaType?: string | null; ctaValue?: string | null; audience?: string;
  createdAt?: number; publishAt?: number | null; expiresAt?: number | null; isDeleted?: boolean;
};

// CTA type <select> options. 'route' takes an in-app route token, 'url' an external link.
const CTA_TYPES: { value: CtaType; label: string }[] = [
  { value: 'none', label: '— no button —' },
  { value: 'route', label: 'In-app route' },
  { value: 'url', label: 'External URL' },
];

// Audience segments. Only "all" (every opted-in user) is supported today.
const AUDIENCES: { value: string; label: string }[] = [
  { value: 'all', label: 'All opted-in users' },
];

// ─── Helpers ───

function contentTypeForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif')) return 'image/gif';
  return file.type || 'application/octet-stream';
}

// Epoch seconds ↔ the <input type="datetime-local"> value (local time, minute precision).
function epochToLocalInput(epochSec: number): string {
  if (!epochSec || epochSec <= 0) return '';
  const d = new Date(epochSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToEpoch(v: string): number {
  if (!v) return 0;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

// Human-readable timestamp for the list rows.
function fmtDate(epochSec: number | null): string {
  if (!epochSec || epochSec <= 0) return '—';
  return new Date(epochSec * 1000).toLocaleString();
}

/**
 * Upload a broadcast hero image directly to R2: presign via store/admin_get_upload_url with
 * itemType 'broadcast_image', then browser PUT. Returns the public URL.
 */
async function uploadBroadcastImageToR2(file: File): Promise<string> {
  const contentType = contentTypeForFile(file);
  const rpcResult = await callAdminRpc('store/admin_get_upload_url', JSON.stringify({
    itemType: 'broadcast_image',
    category: 'broadcast',
    subcategory: 'push',
    contentType,
    fileName: file.name,
  }));
  const data = unwrapAdminRpcData<{ uploadUrl?: string; publicUrl?: string }>(rpcResult);
  if (!data?.uploadUrl || !data?.publicUrl) throw new Error('Failed to get upload URL from backend');
  const putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => '');
    throw new Error(`R2 upload failed (${putRes.status}): ${errText.slice(0, 200)}`);
  }
  return data.publicUrl;
}

function parseBroadcast(raw: RawBroadcast): BroadcastRow {
  return {
    broadcastId: raw.broadcastId || '',
    title: raw.title || '',
    body: raw.body || '',
    imageUrl: raw.imageUrl ?? null,
    ctaType: raw.ctaType ?? null,
    ctaValue: raw.ctaValue ?? null,
    audience: raw.audience || 'all',
    createdAt: raw.createdAt && raw.createdAt > 0 ? raw.createdAt : 0,
    publishAt: raw.publishAt && raw.publishAt > 0 ? raw.publishAt : null,
    expiresAt: raw.expiresAt && raw.expiresAt > 0 ? raw.expiresAt : null,
    isDeleted: raw.isDeleted ?? false,
  };
}

function emptyCompose(): ComposeState {
  return {
    title: '', body: '', imageUrl: '', ctaType: 'none', ctaValue: '',
    audience: 'all', publishAt: 0, expiresAt: 0,
  };
}

// Delivery state for a past broadcast's badge.
function scheduleState(row: BroadcastRow, nowSec: number): { label: string; cls: string } {
  if (row.isDeleted) return { label: 'Retracted', cls: 'bg-red-900/50 text-red-300' };
  if (row.publishAt && row.publishAt > nowSec) return { label: 'Draft', cls: 'bg-amber-900/60 text-amber-200' };
  if (row.expiresAt && row.expiresAt <= nowSec) return { label: 'Expired', cls: 'bg-slate-700 text-slate-400' };
  return { label: 'Live', cls: 'bg-green-900/50 text-green-300' };
}

// ─── Page ───

export default function AdminBroadcastPage() {
  const [compose, setCompose] = useState<ComposeState>(emptyCompose);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  // Stable per-compose-session key so a double-click/retry can't double-send. Regenerated
  // after each successful send so the next broadcast is treated as a new one by the backend.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ result?: string; error?: string }>({});

  // Load (or append) a page of past broadcasts. `reset` starts from the top.
  const loadBroadcasts = useCallback(async (reset: boolean) => {
    setLoading(true);
    try {
      const raw = await callRpc('notifications/admin_list_broadcasts', JSON.stringify({
        cursor: reset ? null : cursor,
        limit: 50,
      }));
      const data = unwrapAdminRpcData<{ broadcasts?: RawBroadcast[]; nextCursor?: string | null; hasMore?: boolean }>(raw);
      const rows = (data.broadcasts ?? []).map(parseBroadcast);
      setBroadcasts((prev) => (reset ? rows : [...prev, ...rows]));
      setCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
      if (reset) setStatus({});
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : 'Failed to load broadcasts' });
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => { loadBroadcasts(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const updateCompose = (patch: Partial<ComposeState>) => setCompose((prev) => ({ ...prev, ...patch }));

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadBroadcastImageToR2(file);
      updateCompose({ imageUrl: url });
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : 'Image upload failed' });
    } finally {
      setUploadingImage(false);
    }
  };

  const sendBroadcast = async () => {
    if (!compose.title.trim()) { setStatus({ error: 'Title is required.' }); return; }
    if (!compose.body.trim()) { setStatus({ error: 'Body is required.' }); return; }
    setSending(true);
    try {
      const raw = await callRpc('notifications/admin_broadcast', JSON.stringify({
        title: compose.title.trim(),
        body: compose.body.trim(),
        imageUrl: compose.imageUrl || null,
        ctaType: compose.ctaType,
        ctaValue: compose.ctaType === 'none' ? null : (compose.ctaValue.trim() || null),
        audience: compose.audience,
        publishAt: compose.publishAt > 0 ? compose.publishAt : null,
        expiresAt: compose.expiresAt > 0 ? compose.expiresAt : null,
        idempotencyKey,
      }));
      const data = unwrapAdminRpcData<{ broadcastId?: string; createdAt?: number; recipientsQueued?: number; pushSent?: boolean }>(raw);
      const queued = data.recipientsQueued ?? 0;
      const scheduled = compose.publishAt > Math.floor(Date.now() / 1000);
      setStatus({
        result: scheduled
          ? `Scheduled — ${queued.toLocaleString()} recipient${queued === 1 ? '' : 's'} queued for ${epochToLocalInput(compose.publishAt).replace('T', ' ')}.`
          : `Broadcast sent — ${queued.toLocaleString()} recipient${queued === 1 ? '' : 's'} queued, push ${data.pushSent ? 'sent' : 'not sent'}.`,
      });
      // Fresh form + fresh idempotency key so the next compose is a distinct send.
      setCompose(emptyCompose());
      setIdempotencyKey(crypto.randomUUID());
      await loadBroadcasts(true);
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : 'Broadcast failed' });
    } finally {
      setSending(false);
    }
  };

  const deleteBroadcast = async (row: BroadcastRow) => {
    if (!row.broadcastId) return;
    if (!window.confirm(`Retract "${row.title || 'this broadcast'}"? Recipients who already received the push will keep it, but it will be hidden going forward.`)) return;
    setBroadcasts((prev) => prev.map((b) => (b.broadcastId === row.broadcastId ? { ...b, deleting: true } : b)));
    try {
      await callRpc('notifications/admin_delete_broadcast', JSON.stringify({ broadcastId: row.broadcastId }));
      setStatus({ result: `Retracted "${row.title}".` });
      await loadBroadcasts(true);
    } catch (e) {
      setBroadcasts((prev) => prev.map((b) => (b.broadcastId === row.broadcastId ? { ...b, deleting: false } : b)));
      setStatus({ error: e instanceof Error ? e.message : 'Retract failed' });
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm';
  const fileCls = 'w-full text-sm text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600';
  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Broadcast
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Send a promotional push (offers, discounts) to every opted-in user. Leave the send date empty to deliver now, or set a future date to schedule it. The hero image is optional. Sends are de-duplicated per compose session, so a retry won&apos;t double-send.
          </p>
        </div>
        <button type="button" onClick={() => loadBroadcasts(true)} disabled={loading} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50 flex items-center gap-1 shrink-0">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Compose form */}
      <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* Hero image preview + upload */}
          <div className="lg:col-span-3 space-y-2">
            {compose.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={compose.imageUrl} alt={compose.title || 'Broadcast image'} className="w-full h-28 object-cover rounded-md border border-slate-600" />
            ) : (
              <div className="w-full h-28 rounded-md border border-dashed border-slate-600 flex items-center justify-center text-slate-500 text-xs">No image (optional)</div>
            )}
            <input type="file" accept=".webp,.png,.jpg,.jpeg,.gif" disabled={uploadingImage} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} className={fileCls} />
            {uploadingImage && <p className="text-[11px] text-slate-400">Uploading…</p>}
          </div>

          {/* Title, body, CTA */}
          <div className="lg:col-span-6 space-y-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Title</label>
              <input value={compose.title} onChange={(e) => updateCompose({ title: e.target.value })} placeholder="e.g. Flash Sale — 30% off all coin packs!" className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Body</label>
              <textarea value={compose.body} onChange={(e) => updateCompose({ body: e.target.value })} rows={4} placeholder="The push message body shown to players." className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">CTA button</label>
                <select value={compose.ctaType} onChange={(e) => updateCompose({ ctaType: e.target.value as CtaType })} className={inputCls}>
                  {CTA_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {compose.ctaType !== 'none' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">{compose.ctaType === 'url' ? 'External URL' : 'In-app route'}</label>
                  <input value={compose.ctaValue} onChange={(e) => updateCompose({ ctaValue: e.target.value })} placeholder={compose.ctaType === 'url' ? 'https://…' : 'e.g. store'} className={inputCls} />
                </div>
              )}
            </div>
          </div>

          {/* Audience + schedule + send */}
          <div className="lg:col-span-3 space-y-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Audience</label>
              <select value={compose.audience} onChange={(e) => updateCompose({ audience: e.target.value })} className={inputCls}>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Send date (blank = send now)</label>
              <input
                type="datetime-local"
                value={epochToLocalInput(compose.publishAt)}
                onChange={(e) => updateCompose({ publishAt: localInputToEpoch(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Expires (blank = never)</label>
              <input
                type="datetime-local"
                value={epochToLocalInput(compose.expiresAt)}
                onChange={(e) => updateCompose({ expiresAt: localInputToEpoch(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={sendBroadcast}
                disabled={sending || uploadingImage}
                className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Send className="w-4 h-4" /> {sending ? 'Sending…' : compose.publishAt > nowSec ? 'Schedule' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {status.result && <p className="text-sm text-green-400">{status.result}</p>}
      {status.error && <p className="text-sm text-red-400">{status.error}</p>}

      {/* Past broadcasts */}
      <h2 className="text-sm font-semibold text-slate-300 pt-2">Past broadcasts</h2>
      {loading && broadcasts.length === 0 && <p className="text-xs text-slate-400">Loading broadcasts…</p>}
      {!loading && broadcasts.length === 0 && <p className="text-xs text-slate-400">No broadcasts sent yet.</p>}

      <div className="space-y-3">
        {broadcasts.map((row) => {
          const st = scheduleState(row, nowSec);
          return (
            <div key={row.broadcastId} className={`p-4 rounded-xl bg-slate-800 border ${row.isDeleted ? 'border-red-900/50 opacity-70' : 'border-slate-700'}`}>
              <div className="flex items-start gap-3">
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.imageUrl} alt={row.title || 'Broadcast image'} className="w-20 h-20 object-cover rounded-md border border-slate-600 shrink-0" />
                ) : null}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    <span className="text-sm font-medium text-slate-100 truncate">{row.title || '(untitled)'}</span>
                  </div>
                  {row.body && <p className="text-xs text-slate-400 whitespace-pre-wrap break-words">{row.body}</p>}
                  <p className="text-[11px] text-slate-500">
                    Sent {fmtDate(row.createdAt)}
                    {row.publishAt ? ` · Scheduled ${fmtDate(row.publishAt)}` : ''}
                    {row.expiresAt ? ` · Expires ${fmtDate(row.expiresAt)}` : ''}
                    {row.ctaType && row.ctaType !== 'none' && row.ctaValue ? ` · CTA (${row.ctaType}): ${row.ctaValue}` : ''}
                  </p>
                </div>
                {!row.isDeleted && (
                  <button
                    type="button"
                    onClick={() => deleteBroadcast(row)}
                    disabled={row.deleting}
                    title="Retract this broadcast"
                    className="px-3 py-2 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-900 disabled:opacity-50 flex items-center justify-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" /> {row.deleting ? '…' : 'Retract'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button type="button" onClick={() => loadBroadcasts(false)} disabled={loading} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50 flex items-center gap-1">
          <RefreshCw className="w-4 h-4" /> {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
