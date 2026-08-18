'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sofa, Plus, RefreshCw, Save, Power, Trash2 } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

// Lounges are fixed, admin-managed public rooms (Plato-style). Each row here maps to a
// `lounges` table row on the backend. Toggling "active" controls visibility in the app's
// lounge/list RPC; the icon is uploaded straight to R2 via the store presign flow.

// ─── Types ───

type LoungeRow = {
  loungeId: string; // empty for a not-yet-saved new lounge
  name: string;
  description: string;
  iconUrl: string;
  sortOrder: number;
  capacity: number;
  isActive: boolean;
  // UI-only flags
  uploadingIcon?: boolean;
  saving?: boolean;
  toggling?: boolean;
};

// Shape returned by lounge/admin_list (only the bits we read).
type RawLounge = {
  loungeId?: string; id?: string; name?: string; description?: string; iconUrl?: string;
  sortOrder?: number; capacity?: number; isActive?: boolean;
};

// ─── Helpers ───

function contentTypeForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif')) return 'image/gif';
  return file.type || 'application/octet-stream';
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Upload a lounge icon directly to R2: presign via store/admin_get_upload_url with
 * itemType 'lounge_icon', then browser PUT. Returns the public URL.
 */
async function uploadLoungeIconToR2(file: File, fileName: string): Promise<string> {
  const contentType = contentTypeForFile(file);
  const rpcResult = await callAdminRpc('store/admin_get_upload_url', JSON.stringify({
    itemType: 'lounge_icon',
    category: 'lounges',
    subcategory: 'icons',
    contentType,
    fileName,
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

function parseLounge(raw: RawLounge): LoungeRow {
  return {
    loungeId: raw.loungeId || raw.id || '',
    name: raw.name || '',
    description: raw.description || '',
    iconUrl: raw.iconUrl || '',
    sortOrder: raw.sortOrder ?? 0,
    capacity: raw.capacity && raw.capacity > 0 ? raw.capacity : 500,
    isActive: raw.isActive ?? true,
  };
}

function emptyLounge(rows: LoungeRow[]): LoungeRow {
  const maxSort = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0);
  return { loungeId: '', name: '', description: '', iconUrl: '', sortOrder: maxSort + 1, capacity: 500, isActive: true };
}

// ─── Page ───

export default function AdminLoungesPage() {
  const [lounges, setLounges] = useState<LoungeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ result?: string; error?: string }>({});

  const loadLounges = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await callRpc('lounge/admin_list', '{}');
      const data = unwrapAdminRpcData<{ lounges?: RawLounge[] }>(raw);
      setLounges((data.lounges ?? []).map(parseLounge));
      setStatus({});
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : 'Failed to load lounges' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLounges(); }, [loadLounges]);

  const updateRow = (i: number, patch: Partial<LoungeRow>) =>
    setLounges((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const addLounge = () => setLounges((prev) => [...prev, emptyLounge(prev)]);

  const removeUnsavedRow = (i: number) =>
    setLounges((prev) => prev.filter((_, j) => j !== i));

  const handleIconUpload = async (i: number, file: File) => {
    const row = lounges[i];
    const baseName = slugify(row.name) || (row.loungeId ? `lounge_${row.loungeId}` : `lounge_${Date.now()}`);
    updateRow(i, { uploadingIcon: true });
    try {
      const url = await uploadLoungeIconToR2(file, baseName);
      updateRow(i, { iconUrl: url, uploadingIcon: false });
    } catch (e) {
      updateRow(i, { uploadingIcon: false });
      setStatus({ error: e instanceof Error ? e.message : 'Icon upload failed' });
    }
  };

  const saveLounge = async (i: number) => {
    const row = lounges[i];
    if (!row.name.trim()) { setStatus({ error: 'Lounge name is required.' }); return; }
    if (row.capacity < 1) { setStatus({ error: 'Capacity must be at least 1.' }); return; }
    updateRow(i, { saving: true });
    try {
      await callRpc('lounge/admin_upsert', JSON.stringify({
        ...(row.loungeId ? { id: row.loungeId } : {}),
        name: row.name.trim(),
        description: row.description,
        iconUrl: row.iconUrl,
        sortOrder: row.sortOrder,
        capacity: row.capacity,
        isActive: row.isActive,
      }));
      setStatus({ result: `Saved "${row.name.trim()}".` });
      // Re-fetch so new lounges pick up their server-assigned id.
      await loadLounges();
    } catch (e) {
      updateRow(i, { saving: false });
      setStatus({ error: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const toggleActive = async (i: number) => {
    const row = lounges[i];
    if (!row.loungeId) return;
    const next = !row.isActive;
    updateRow(i, { toggling: true });
    try {
      await callRpc('lounge/admin_set_active', JSON.stringify({ loungeId: row.loungeId, isActive: next }));
      updateRow(i, { isActive: next, toggling: false });
      setStatus({ result: `"${row.name}" is now ${next ? 'active' : 'inactive'}.` });
    } catch (e) {
      updateRow(i, { toggling: false });
      setStatus({ error: e instanceof Error ? e.message : 'Failed to toggle active state' });
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm';
  const fileCls = 'w-full text-sm text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600';

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Sofa className="w-5 h-5" /> Lounges
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Fixed public lounges shown in the app (Games / Chat / Online tabs). Inactive lounges disappear from the player-facing list; sort order controls their position.
          </p>
        </div>
        <button type="button" onClick={loadLounges} disabled={loading} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50 flex items-center gap-1 shrink-0">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading && lounges.length === 0 && <p className="text-xs text-slate-400">Loading lounges…</p>}
      {!loading && lounges.length === 0 && <p className="text-xs text-slate-400">No lounges yet — add the first one below.</p>}

      {/* Lounge rows */}
      <div className="space-y-3">
        {lounges.map((lounge, i) => (
          <div key={lounge.loungeId || `new-${i}`} className={`p-4 rounded-xl bg-slate-800 border space-y-3 ${lounge.isActive ? 'border-slate-700' : 'border-red-900/60'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
              {/* Icon preview + upload */}
              <div className="lg:col-span-2 space-y-2">
                {lounge.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lounge.iconUrl} alt={lounge.name || 'Lounge icon'} className="w-20 h-20 object-cover rounded-md border border-slate-600" />
                ) : (
                  <div className="w-20 h-20 rounded-md border border-dashed border-slate-600 flex items-center justify-center text-slate-500 text-xs">No icon</div>
                )}
                <input type="file" accept=".webp,.png,.jpg,.jpeg,.gif" disabled={lounge.uploadingIcon} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIconUpload(i, f); }} className={fileCls} />
                {lounge.uploadingIcon && <p className="text-[11px] text-slate-400">Uploading…</p>}
              </div>

              {/* Name + description */}
              <div className="lg:col-span-5 space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Name</label>
                  <input value={lounge.name} onChange={(e) => updateRow(i, { name: e.target.value })} placeholder="e.g. Love Connection" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                  <input value={lounge.description} onChange={(e) => updateRow(i, { description: e.target.value })} placeholder="Short blurb shown on the lounge card" className={inputCls} />
                </div>
              </div>

              {/* Sort order + capacity */}
              <div className="lg:col-span-2 space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Sort order</label>
                  <input type="number" value={lounge.sortOrder} onChange={(e) => updateRow(i, { sortOrder: parseInt(e.target.value, 10) || 0 })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Capacity</label>
                  <input type="number" min={1} value={lounge.capacity} onChange={(e) => updateRow(i, { capacity: Math.max(1, parseInt(e.target.value, 10) || 1) })} className={inputCls} />
                </div>
              </div>

              {/* Actions */}
              <div className="lg:col-span-3 flex lg:flex-col gap-2 lg:items-end">
                <button
                  type="button"
                  onClick={() => saveLounge(i)}
                  disabled={lounge.saving || lounge.uploadingIcon}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1"
                >
                  <Save className="w-4 h-4" /> {lounge.saving ? 'Saving…' : lounge.loungeId ? 'Save' : 'Create'}
                </button>
                {lounge.loungeId ? (
                  <button
                    type="button"
                    onClick={() => toggleActive(i)}
                    disabled={lounge.toggling}
                    title={lounge.isActive ? 'Deactivate (hide from players)' : 'Activate (show to players)'}
                    className={`px-3 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1 ${lounge.isActive ? 'bg-green-900/50 text-green-300 hover:bg-green-900' : 'bg-red-900/60 text-red-200 hover:bg-red-900'}`}
                  >
                    <Power className="w-4 h-4" /> {lounge.toggling ? '…' : lounge.isActive ? 'Active' : 'Inactive'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeUnsavedRow(i)}
                    title="Discard this unsaved lounge"
                    className="px-3 py-2 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-900 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Discard
                  </button>
                )}
              </div>
            </div>
            {lounge.loungeId && <p className="text-[11px] text-slate-500">id: {lounge.loungeId}</p>}
          </div>
        ))}
      </div>

      <button type="button" onClick={addLounge} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 flex items-center gap-1">
        <Plus className="w-4 h-4" /> Add lounge
      </button>

      {status.result && <p className="text-sm text-green-400">{status.result}</p>}
      {status.error && <p className="text-sm text-red-400">{status.error}</p>}
    </div>
  );
}
