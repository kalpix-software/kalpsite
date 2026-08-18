'use client';

import { useEffect, useState } from 'react';
import { Gamepad2, RefreshCw } from 'lucide-react';
import { callAdminRpc } from '@/lib/admin-rpc';

/**
 * Game catalog admin: name, description, icon, banner, visibility.
 *
 * These columns were previously editable only by SQL. The seeded values were
 * relative paths like "/assets/games/tero/icon.webp", which plak passes
 * straight to CachedNetworkImageProvider — a hostless path it cannot resolve,
 * so the tiles fell back to a placeholder. Uploading here writes a full R2 URL,
 * matching how avatars and every other asset already work.
 */

type Game = {
  gameId: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string;
  bannerUrl: string;
  isActive: boolean;
  category: string;
};

/** A stored value the app cannot actually load — no scheme and no host. */
function isUnresolvable(url: string): boolean {
  return url.trim() !== '' && !/^https?:\/\//i.test(url);
}

async function uploadToR2(file: File, itemType: 'game_icon' | 'game_banner', slug: string): Promise<string> {
  const fd = new FormData();
  fd.append('itemType', itemType);
  fd.append('category', slug);
  fd.append('subcategory', '');
  fd.append('fileName', file.name);
  fd.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok || !data?.publicUrl) throw new Error(data?.error || `Upload failed (${res.status})`);
  return data.publicUrl as string;
}

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState('');
  // Held in state, not a ref, so the Save button can appear the moment the text
  // differs from what is stored. Text edits are confirmed explicitly — unlike the
  // image uploads and the Live toggle, which are unambiguous single actions.
  const [text, setText] = useState<Record<string, { name: string; description: string }>>({});

  const isDirty = (g: Game) => {
    const t = text[g.gameId];
    return !!t && (t.name.trim() !== g.name || t.description !== g.description);
  };

  const resetText = (g: Game) => setText((p) => { const n = { ...p }; delete n[g.gameId]; return n; });

  const saveText = async (g: Game) => {
    const t = text[g.gameId];
    if (!t || !isDirty(g)) return;
    if (!t.name.trim()) { setMsg({ id: g.gameId, text: 'Name cannot be blank.', error: true }); return; }
    const fields: Record<string, unknown> = {};
    if (t.name.trim() !== g.name) fields.name = t.name.trim();
    if (t.description !== g.description) fields.description = t.description;
    await patch(g, fields, 'Saved');
    resetText(g);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callAdminRpc('game/admin_list_games', '{}');
      const raw = (data?.data ?? data) as { games?: Game[] };
      setGames(raw?.games ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const patch = async (g: Game, fields: Record<string, unknown>, note: string) => {
    setBusy(g.gameId);
    setMsg(null);
    try {
      await callAdminRpc('game/admin_update_game', JSON.stringify({ gameId: g.gameId, ...fields }));
      setGames((prev) => prev.map((x) => (x.gameId === g.gameId ? { ...x, ...fields } as Game : x)));
      setMsg({ id: g.gameId, text: note });
    } catch (e) {
      setMsg({ id: g.gameId, text: e instanceof Error ? e.message : 'Save failed', error: true });
    } finally {
      setBusy('');
    }
  };

  const upload = async (g: Game, kind: 'game_icon' | 'game_banner', file: File) => {
    if (!['image/webp', 'image/png', 'image/jpeg'].includes(file.type)) {
      setMsg({ id: g.gameId, text: 'Use WebP, PNG or JPEG.', error: true });
      return;
    }
    setBusy(g.gameId);
    setMsg(null);
    try {
      const url = await uploadToR2(file, kind, g.slug);
      const field = kind === 'game_icon' ? 'iconUrl' : 'bannerUrl';
      // The key is timestamped, so this is a brand-new url every time and no
      // cache anywhere can serve the previous image.
      await callAdminRpc('game/admin_update_game', JSON.stringify({ gameId: g.gameId, [field]: url }));
      setGames((prev) => prev.map((x) => (x.gameId === g.gameId ? { ...x, [field]: url } as Game : x)));
      setMsg({ id: g.gameId, text: `${kind === 'game_icon' ? 'Icon' : 'Banner'} updated — live immediately` });
    } catch (e) {
      setMsg({ id: g.gameId, text: e instanceof Error ? e.message : 'Upload failed', error: true });
    } finally {
      setBusy('');
    }
  };

  const broken = games.filter((g) => isUnresolvable(g.iconUrl) || isUnresolvable(g.bannerUrl));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Gamepad2 className="w-6 h-6" />
          Games
        </h1>
        <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600">
          <RefreshCw className="w-4 h-4" /> Reload
        </button>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        Name, artwork and visibility for each game tile. Changes are live as soon as they save — the app reads these from
        <code className="bg-slate-800 px-1 rounded mx-1">game/get_catalog</code> on every launch.
      </p>

      {broken.length > 0 && (
        <div className="mb-5 p-4 rounded-xl bg-amber-950/40 border border-amber-800 text-sm">
          <p className="text-amber-300 font-medium mb-1">
            {broken.length} game{broken.length > 1 ? 's have' : ' has'} artwork the app cannot load
          </p>
          <p className="text-amber-200/80 text-xs">
            The stored value is a relative path with no host (for example <code>/assets/games/tero/icon.webp</code>). The app
            passes it straight to the image loader, which needs a full URL — so the tile shows a placeholder. Uploading a
            file below replaces it with a proper R2 URL and fixes it.
          </p>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : games.length === 0 ? (
        <p className="text-slate-400 text-sm">No games found.</p>
      ) : (
        <div className="space-y-4">
          {games.map((g) => (
            <div key={g.gameId} className="p-4 rounded-xl bg-slate-800 border border-slate-700">
              <div className="flex items-start gap-4 flex-wrap">
                {/* Icon */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Icon</label>
                  <label className="cursor-pointer block" title="Click to replace. Any filename.">
                    {g.iconUrl && !isUnresolvable(g.iconUrl) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={g.iconUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-600 hover:border-indigo-500" />
                    ) : (
                      <span className="w-16 h-16 rounded-xl border border-dashed border-slate-600 hover:border-indigo-500 flex items-center justify-center text-[10px] text-slate-500 text-center px-1">
                        {isUnresolvable(g.iconUrl) ? 'broken' : 'Add'}
                      </span>
                    )}
                    <input type="file" accept="image/webp,image/png,image/jpeg" className="hidden" disabled={busy === g.gameId}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(g, 'game_icon', f); e.target.value = ''; }} />
                  </label>
                </div>

                {/* Banner */}
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs text-slate-400 mb-1">Banner</label>
                  <label className="cursor-pointer block" title="Click to replace.">
                    {g.bannerUrl && !isUnresolvable(g.bannerUrl) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={g.bannerUrl} alt="" className="w-full h-16 rounded-xl object-cover border border-slate-600 hover:border-indigo-500" />
                    ) : (
                      <span className="w-full h-16 rounded-xl border border-dashed border-slate-600 hover:border-indigo-500 flex items-center justify-center text-[11px] text-slate-500">
                        {isUnresolvable(g.bannerUrl) ? 'broken — click to replace' : 'Add banner'}
                      </span>
                    )}
                    <input type="file" accept="image/webp,image/png,image/jpeg" className="hidden" disabled={busy === g.gameId}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(g, 'game_banner', f); e.target.value = ''; }} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Slug <span className="text-slate-500">(internal, fixed)</span></label>
                  <input value={g.slug} disabled title="Keys the R2 paths and the webview lookup — changing it would orphan the art."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-500 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Name <span className="text-slate-500">(shown to players)</span></label>
                  <input value={text[g.gameId]?.name ?? g.name}
                    onChange={(e) => setText((p) => ({ ...p, [g.gameId]: { ...(p[g.gameId] ?? { name: g.name, description: g.description }), name: e.target.value } }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveText(g); }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Description</label>
                  <input value={text[g.gameId]?.description ?? g.description}
                    onChange={(e) => setText((p) => ({ ...p, [g.gameId]: { ...(p[g.gameId] ?? { name: g.name, description: g.description }), description: e.target.value } }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveText(g); }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={g.isActive} disabled={busy === g.gameId}
                    onChange={(e) => void patch(g, { isActive: e.target.checked }, e.target.checked ? 'Visible to players' : 'Hidden from players')}
                    className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500" />
                  <span className={g.isActive ? 'text-green-400' : 'text-amber-400'}>{g.isActive ? 'Live' : 'Hidden'}</span>
                </label>
                {isDirty(g) && (
                  <>
                    <button type="button" onClick={() => void saveText(g)} disabled={busy === g.gameId}
                      className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 disabled:opacity-50">
                      {busy === g.gameId ? 'Saving…' : 'Save changes'}
                    </button>
                    <button type="button" onClick={() => resetText(g)} disabled={busy === g.gameId}
                      className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600">
                      Cancel
                    </button>
                  </>
                )}
                {msg?.id === g.gameId && (
                  <span className={`text-xs ${msg.error ? 'text-red-400' : 'text-emerald-400'}`}>{msg.text}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
