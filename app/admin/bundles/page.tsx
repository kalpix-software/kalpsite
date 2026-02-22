'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { callAdminRpc } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

interface Bundle {
  bundleId: string;
  name: string;
  description: string;
  itemIds: string[];
  price: { coins: number; gems: number };
  originalPrice: { coins: number; gems: number };
  isActive: boolean;
  isLimited: boolean;
  category: string;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function AddBundleForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    bundleId: '', name: '', description: '', itemIdsRaw: '', category: '',
    coins: 0, gems: 0, isActive: true,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const itemIds = form.itemIdsRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (itemIds.length === 0) { setError('At least one item ID required'); setSaving(false); return; }
      const bundleId = form.bundleId.trim() || generateId();
      const bundle = {
        bundleId,
        name: form.name,
        description: form.description,
        itemIds,
        category: form.category || undefined,
        price: { coins: form.coins, gems: form.gems },
        isActive: form.isActive,
      };
      await callRpc('store/admin_add_bundle', JSON.stringify(bundle));
      setOpen(false);
      setForm({ bundleId: '', name: '', description: '', itemIdsRaw: '', category: '', coins: 0, gems: 0, isActive: true });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500">
        <Plus className="w-4 h-4" /> Add Bundle
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="p-4 rounded-xl bg-slate-800 border border-slate-700 mb-4 space-y-3">
      <h3 className="text-sm font-medium text-slate-100">Add New Bundle</h3>
      <p className="text-xs text-slate-400">Leave Bundle ID empty to auto-generate (UUID).</p>
      <div className="grid grid-cols-2 gap-3">
        <input value={form.bundleId} onChange={e => setForm(f => ({ ...f, bundleId: e.target.value }))} placeholder="Bundle ID (optional; auto-generated if empty)" className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Bundle Name" required className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
        <input value={form.coins} onChange={e => setForm(f => ({ ...f, coins: parseInt(e.target.value) || 0 }))} type="number" placeholder="Bundle Price (Coins)" className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
        <input value={form.gems} onChange={e => setForm(f => ({ ...f, gems: parseInt(e.target.value) || 0 }))} type="number" placeholder="Bundle Price (Gems)" className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
      </div>
      <input value={form.itemIdsRaw} onChange={e => setForm(f => ({ ...f, itemIdsRaw: e.target.value }))} placeholder="Item IDs (comma-separated, e.g. uno_card_back_gold,uno_bg_midnight)" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
      <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Adding...' : 'Add Bundle'}</button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg bg-slate-600 text-slate-200 text-sm">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callRpc('store/get_bundles', '{}') as { data?: { bundles?: Bundle[] }; bundles?: Bundle[] };
      const d = data?.data ?? data;
      setBundles(d?.bundles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteBundle = async (bundleId: string) => {
    if (!confirm(`Delete bundle ${bundleId}?`)) return;
    try {
      await callRpc('store/admin_delete_bundle', JSON.stringify({ bundleId }));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Bundles</h1>
        <AddBundleForm onAdded={load} />
      </div>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : bundles.length === 0 ? (
        <p className="text-slate-500">No bundles yet. Create one to offer discounted packs.</p>
      ) : (
        <div className="space-y-3">
          {bundles.map(b => (
            <div key={b.bundleId} className="p-4 rounded-xl bg-slate-800 border border-slate-700">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-slate-100">{b.name}</h3>
                  <p className="text-xs text-slate-500">{b.bundleId}</p>
                  <p className="text-sm text-slate-400 mt-1">{b.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.itemIds.map(id => (
                      <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{id}</span>
                    ))}
                  </div>
                  <p className="text-sm mt-2">
                    <span className="text-green-400 font-medium">
                      {b.price.coins > 0 && `${b.price.coins}c`}
                      {b.price.coins > 0 && b.price.gems > 0 && ' / '}
                      {b.price.gems > 0 && `${b.price.gems}g`}
                    </span>
                    {(b.originalPrice?.coins > 0 || b.originalPrice?.gems > 0) && (
                      <span className="text-slate-500 line-through ml-2 text-xs">
                        {b.originalPrice.coins > 0 && `${b.originalPrice.coins}c`}
                        {b.originalPrice.coins > 0 && b.originalPrice.gems > 0 && ' / '}
                        {b.originalPrice.gems > 0 && `${b.originalPrice.gems}g`}
                      </span>
                    )}
                  </p>
                </div>
                <button onClick={() => deleteBundle(b.bundleId)} className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
