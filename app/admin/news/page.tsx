'use client';

import { useState, useEffect, useCallback } from 'react';
import { Newspaper, Plus, RefreshCw, Save, Power, Trash2 } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

// News posts are admin-managed home-screen announcements (Plato-style). Each row here maps
// to a `news_posts` table row on the backend. Publishing controls visibility in the app's
// news/list RPC — a post shows in-app only when it is published AND its publish date has
// arrived, so a future publish date queues the post. The hero image is optional and is
// uploaded straight to R2 via the store presign flow. Body is Markdown.

// ─── Types ───

type NewsRow = {
  postId: string; // empty for a not-yet-saved new post
  title: string;
  body: string; // markdown source
  excerpt: string; // 1–2 line teaser for cards
  author: string; // byline, e.g. "Kalpix Games Team"
  imageUrl: string;
  category: string; // slug (see CATEGORIES)
  ctaLabel: string; // "" = no CTA button
  ctaAction: string; // action token; "url:https://…" for external links
  isPinned: boolean; // rides the featured carousel
  priority: number; // featured ordering (higher first)
  publishAt: number; // epoch seconds
  isPublished: boolean;
  sortOrder: number;
  // UI-only flags
  uploadingImage?: boolean;
  saving?: boolean;
  toggling?: boolean;
  deleting?: boolean;
};

// Shape returned by news/admin_list (only the bits we read).
type RawNews = {
  id?: string; postId?: string; title?: string; body?: string; imageUrl?: string;
  category?: string; publishAt?: number; isPublished?: boolean; sortOrder?: number;
  excerpt?: string; author?: string; ctaLabel?: string; ctaAction?: string;
  isPinned?: boolean; priority?: number;
};

// Enumerated categories (slug + label) — the app maps each slug to a color +
// emoji badge. Keep in sync with the Flutter news_category.dart map.
const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: '— none —' },
  { value: 'events', label: '🏆 Events' },
  { value: 'new_drops', label: '🎫 New Drops' },
  { value: 'updates', label: '🎮 Updates / Patch Notes' },
  { value: 'rewards', label: '🎁 Rewards' },
  { value: 'community', label: '👑 Community' },
  { value: 'announcements', label: '📢 Announcements' },
];

// Preset CTA destinations. 'url' is special: the stored ctaAction becomes
// "url:<https…>" so the app opens it externally. Keep tokens in sync with the
// Flutter news_cta.dart resolver.
const CTA_ACTIONS: { value: string; label: string }[] = [
  { value: '', label: '— no button —' },
  { value: 'tero_lobby', label: 'Open Tero lobby' },
  { value: 'store', label: 'Open Store' },
  { value: 'daily_rewards', label: 'Open Daily Rewards' },
  { value: 'leaderboards', label: 'Open Leaderboards' },
  { value: 'lounges', label: 'Open Lounges' },
  { value: 'url', label: 'External URL…' },
];

// Derive the action-type <select> value from the stored token.
function ctaActionType(action: string): string {
  return action.startsWith('url:') ? 'url' : action;
}
function ctaUrlValue(action: string): string {
  return action.startsWith('url:') ? action.slice(4) : '';
}

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

/**
 * Upload a news hero image directly to R2: presign via store/admin_get_upload_url with
 * itemType 'news_image', then browser PUT. Returns the public URL.
 */
async function uploadNewsImageToR2(file: File): Promise<string> {
  const contentType = contentTypeForFile(file);
  const rpcResult = await callAdminRpc('store/admin_get_upload_url', JSON.stringify({
    itemType: 'news_image',
    category: 'news',
    subcategory: 'posts',
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

function parseNews(raw: RawNews): NewsRow {
  return {
    postId: raw.postId || raw.id || '',
    title: raw.title || '',
    body: raw.body || '',
    excerpt: raw.excerpt || '',
    author: raw.author || '',
    imageUrl: raw.imageUrl || '',
    category: raw.category || '',
    ctaLabel: raw.ctaLabel || '',
    ctaAction: raw.ctaAction || '',
    isPinned: raw.isPinned ?? false,
    priority: raw.priority ?? 0,
    publishAt: raw.publishAt && raw.publishAt > 0 ? raw.publishAt : 0,
    isPublished: raw.isPublished ?? false,
    sortOrder: raw.sortOrder ?? 0,
  };
}

function emptyNews(rows: NewsRow[]): NewsRow {
  const maxSort = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0);
  return {
    postId: '', title: '', body: '', excerpt: '', author: '', imageUrl: '', category: '',
    ctaLabel: '', ctaAction: '', isPinned: false, priority: 0,
    publishAt: Math.floor(Date.now() / 1000), isPublished: false, sortOrder: maxSort + 1,
  };
}

// Human-readable publish state for the row badge.
function publishState(row: NewsRow, nowSec: number): { label: string; cls: string } {
  if (!row.isPublished) return { label: 'Draft', cls: 'bg-slate-700 text-slate-300' };
  if (row.publishAt > nowSec) return { label: 'Scheduled', cls: 'bg-amber-900/60 text-amber-200' };
  return { label: 'Live', cls: 'bg-green-900/50 text-green-300' };
}

// ─── Page ───

export default function AdminNewsPage() {
  const [posts, setPosts] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ result?: string; error?: string }>({});

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await callRpc('news/admin_list', '{}');
      const data = unwrapAdminRpcData<{ posts?: RawNews[] }>(raw);
      setPosts((data.posts ?? []).map(parseNews));
      setStatus({});
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : 'Failed to load news' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const updateRow = (i: number, patch: Partial<NewsRow>) =>
    setPosts((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const addPost = () => setPosts((prev) => [...prev, emptyNews(prev)]);

  const removeUnsavedRow = (i: number) =>
    setPosts((prev) => prev.filter((_, j) => j !== i));

  const handleImageUpload = async (i: number, file: File) => {
    updateRow(i, { uploadingImage: true });
    try {
      const url = await uploadNewsImageToR2(file);
      updateRow(i, { imageUrl: url, uploadingImage: false });
    } catch (e) {
      updateRow(i, { uploadingImage: false });
      setStatus({ error: e instanceof Error ? e.message : 'Image upload failed' });
    }
  };

  const savePost = async (i: number) => {
    const row = posts[i];
    if (!row.title.trim()) { setStatus({ error: 'Title is required.' }); return; }
    updateRow(i, { saving: true });
    try {
      await callRpc('news/admin_upsert', JSON.stringify({
        ...(row.postId ? { id: row.postId } : {}),
        title: row.title.trim(),
        body: row.body,
        excerpt: row.excerpt.trim(),
        author: row.author.trim(),
        imageUrl: row.imageUrl,
        category: row.category,
        ctaLabel: row.ctaLabel.trim(),
        ctaAction: row.ctaAction,
        isPinned: row.isPinned,
        priority: row.priority,
        publishAt: row.publishAt,
        isPublished: row.isPublished,
        sortOrder: row.sortOrder,
      }));
      setStatus({ result: `Saved "${row.title.trim()}".` });
      // Re-fetch so new posts pick up their server-assigned id.
      await loadPosts();
    } catch (e) {
      updateRow(i, { saving: false });
      setStatus({ error: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const togglePublished = async (i: number) => {
    const row = posts[i];
    if (!row.postId) return;
    const next = !row.isPublished;
    updateRow(i, { toggling: true });
    try {
      await callRpc('news/admin_set_published', JSON.stringify({ postId: row.postId, isPublished: next }));
      updateRow(i, { isPublished: next, toggling: false });
      setStatus({ result: `"${row.title}" is now ${next ? 'published' : 'unpublished'}.` });
    } catch (e) {
      updateRow(i, { toggling: false });
      setStatus({ error: e instanceof Error ? e.message : 'Failed to toggle published state' });
    }
  };

  const deletePost = async (i: number) => {
    const row = posts[i];
    if (!row.postId) { removeUnsavedRow(i); return; }
    if (!window.confirm(`Delete "${row.title || 'this post'}" permanently? This cannot be undone.`)) return;
    updateRow(i, { deleting: true });
    try {
      await callRpc('news/admin_delete', JSON.stringify({ postId: row.postId }));
      setStatus({ result: `Deleted "${row.title}".` });
      await loadPosts();
    } catch (e) {
      updateRow(i, { deleting: false });
      setStatus({ error: e instanceof Error ? e.message : 'Delete failed' });
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
            <Newspaper className="w-5 h-5" /> News
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Home-screen news posts (Plato-style). A post appears in the app only when it is published and its publish date has arrived — set a future date to schedule it. Body supports Markdown. The hero image is optional.
          </p>
        </div>
        <button type="button" onClick={loadPosts} disabled={loading} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50 flex items-center gap-1 shrink-0">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading && posts.length === 0 && <p className="text-xs text-slate-400">Loading news…</p>}
      {!loading && posts.length === 0 && <p className="text-xs text-slate-400">No news posts yet — add the first one below.</p>}

      {/* News rows */}
      <div className="space-y-3">
        {posts.map((post, i) => {
          const st = publishState(post, nowSec);
          return (
            <div key={post.postId || `new-${i}`} className={`p-4 rounded-xl bg-slate-800 border space-y-3 ${post.isPublished ? 'border-slate-700' : 'border-amber-900/50'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                {post.isPinned && <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-200">★ Featured</span>}
                {post.category && <span className="text-[11px] text-slate-400 ml-auto">{CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}</span>}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                {/* Hero image preview + upload */}
                <div className="lg:col-span-3 space-y-2">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.imageUrl} alt={post.title || 'News image'} className="w-full h-28 object-cover rounded-md border border-slate-600" />
                  ) : (
                    <div className="w-full h-28 rounded-md border border-dashed border-slate-600 flex items-center justify-center text-slate-500 text-xs">No image (optional)</div>
                  )}
                  <input type="file" accept=".webp,.png,.jpg,.jpeg,.gif" disabled={post.uploadingImage} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(i, f); }} className={fileCls} />
                  {post.uploadingImage && <p className="text-[11px] text-slate-400">Uploading…</p>}
                </div>

                {/* Title, byline, category, excerpt, body, CTA */}
                <div className="lg:col-span-6 space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Title</label>
                    <input value={post.title} onChange={(e) => updateRow(i, { title: e.target.value })} placeholder="e.g. Weekend Tero Cup — Win up to 5,000 coins" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Category</label>
                      <select value={post.category} onChange={(e) => updateRow(i, { category: e.target.value })} className={inputCls}>
                        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Author / source</label>
                      <input value={post.author} onChange={(e) => updateRow(i, { author: e.target.value })} placeholder="e.g. Kalpix Games Team" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Excerpt (card teaser, 1–2 lines)</label>
                    <textarea value={post.excerpt} onChange={(e) => updateRow(i, { excerpt: e.target.value })} rows={2} placeholder="Short teaser shown on the feed card." className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Body (Markdown)</label>
                    <textarea value={post.body} onChange={(e) => updateRow(i, { body: e.target.value })} rows={5} placeholder="Write the article… **bold**, _italic_, [links](https://…), ## headings, lists supported." className={`${inputCls} font-mono`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">CTA button label</label>
                      <input value={post.ctaLabel} onChange={(e) => updateRow(i, { ctaLabel: e.target.value })} placeholder="e.g. Join Tournament (blank = no button)" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">CTA opens</label>
                      <select
                        value={ctaActionType(post.ctaAction)}
                        onChange={(e) => updateRow(i, { ctaAction: e.target.value === 'url' ? `url:${ctaUrlValue(post.ctaAction)}` : e.target.value })}
                        className={inputCls}
                      >
                        {CTA_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {ctaActionType(post.ctaAction) === 'url' && (
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">External URL</label>
                      <input value={ctaUrlValue(post.ctaAction)} onChange={(e) => updateRow(i, { ctaAction: `url:${e.target.value}` })} placeholder="https://…" className={inputCls} />
                    </div>
                  )}
                </div>

                {/* Publish date + sort order + actions */}
                <div className="lg:col-span-3 space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Publish date</label>
                    <input
                      type="datetime-local"
                      value={epochToLocalInput(post.publishAt)}
                      onChange={(e) => updateRow(i, { publishAt: localInputToEpoch(e.target.value) })}
                      className={inputCls}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={post.isPinned}
                      onChange={(e) => updateRow(i, { isPinned: e.target.checked })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    Featured (top carousel)
                  </label>
                  {post.isPinned && (
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Featured priority (higher first)</label>
                      <input type="number" value={post.priority} onChange={(e) => updateRow(i, { priority: parseInt(e.target.value, 10) || 0 })} className={inputCls} />
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Sort order (tiebreak)</label>
                    <input type="number" value={post.sortOrder} onChange={(e) => updateRow(i, { sortOrder: parseInt(e.target.value, 10) || 0 })} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => savePost(i)}
                      disabled={post.saving || post.uploadingImage}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Save className="w-4 h-4" /> {post.saving ? 'Saving…' : post.postId ? 'Save' : 'Create'}
                    </button>
                    {post.postId && (
                      <button
                        type="button"
                        onClick={() => togglePublished(i)}
                        disabled={post.toggling}
                        title={post.isPublished ? 'Unpublish (hide from players)' : 'Publish (show to players)'}
                        className={`px-3 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1 ${post.isPublished ? 'bg-green-900/50 text-green-300 hover:bg-green-900' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                      >
                        <Power className="w-4 h-4" /> {post.toggling ? '…' : post.isPublished ? 'Published' : 'Draft'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePost(i)}
                      disabled={post.deleting}
                      title={post.postId ? 'Delete this post permanently' : 'Discard this unsaved post'}
                      className="px-3 py-2 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-900 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" /> {post.deleting ? '…' : post.postId ? 'Delete' : 'Discard'}
                    </button>
                  </div>
                </div>
              </div>
              {post.postId && <p className="text-[11px] text-slate-500">id: {post.postId}</p>}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={addPost} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 flex items-center gap-1">
        <Plus className="w-4 h-4" /> Add news post
      </button>

      {status.result && <p className="text-sm text-green-400">{status.result}</p>}
      {status.error && <p className="text-sm text-red-400">{status.error}</p>}
    </div>
  );
}
