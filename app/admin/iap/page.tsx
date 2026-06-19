'use client';

import { useCallback, useEffect, useState } from 'react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface IAPProduct {
  productId: string;
  name: string;
  description: string;
  coinsAmount: number;
  gemsAmount: number;
  bonusGems: number;
  price: number;
  currency: string;
  platform: string;
  isActive: boolean;
  isFeatured: boolean;
  iconUrl: string;
  createdAt?: number;
  updatedAt?: number;
}

const EMPTY: IAPProduct = {
  productId: '',
  name: '',
  description: '',
  coinsAmount: 0,
  gemsAmount: 0,
  bonusGems: 0,
  price: 0,
  currency: 'INR',
  platform: 'all',
  isActive: true,
  isFeatured: false,
  iconUrl: '',
};

export default function AdminIAPPage() {
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<IAPProduct>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = (await callAdminRpc('store/admin_get_iap_products')) as {
        data?: { products?: IAPProduct[] };
        products?: IAPProduct[];
      };
      const d = res?.data ?? res;
      const list = d?.products ?? [];
      // Sort by price so the ladder reads top-to-bottom.
      list.sort((a, b) => a.price - b.price);
      setProducts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof IAPProduct>(key: K, value: IAPProduct[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const startEdit = (p: IAPProduct) => {
    setForm(p);
    setEditingId(p.productId);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError('');
  };

  const save = async () => {
    if (!form.productId.trim() || !form.name.trim()) {
      setError('productId and name are required');
      return;
    }
    if (form.coinsAmount <= 0 && form.gemsAmount <= 0) {
      setError('Set a coins amount or a gems amount (or both)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await callAdminRpc('store/admin_upsert_iap_product', JSON.stringify(form));
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (productId: string) => {
    if (!confirm(`Delete IAP product "${productId}"? This cannot be undone.`)) return;
    setError('');
    try {
      await callAdminRpc('store/admin_delete_iap_product', JSON.stringify({ productId }));
      if (editingId === productId) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const coinPacks = products.filter((p) => p.coinsAmount > 0 && p.gemsAmount === 0);
  const gemPacks = products.filter((p) => p.gemsAmount > 0 && p.coinsAmount === 0);
  const bundles = products.filter((p) => p.coinsAmount > 0 && p.gemsAmount > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">In-App Purchases</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-money coin and gem packs. Product IDs must match Google Play Console / App Store Connect.
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {/* Add / Edit form */}
      <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 mb-8 max-w-3xl">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          {editingId ? `Edit "${editingId}"` : 'Add Product'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Product ID *</label>
            <input
              value={form.productId}
              onChange={(e) => set('productId', e.target.value)}
              disabled={!!editingId}
              placeholder="e.g. coins_1000"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. 1000 Coins"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Shown under the pack name"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Coins granted</label>
            <input
              type="number"
              value={form.coinsAmount}
              onChange={(e) => set('coinsAmount', Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Gems granted</label>
            <input
              type="number"
              value={form.gemsAmount}
              onChange={(e) => set('gemsAmount', Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bonus gems</label>
            <input
              type="number"
              value={form.bonusGems}
              onChange={(e) => set('bonusGems', Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Price</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => set('price', Number(e.target.value))}
              min={0}
              step="0.01"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Currency</label>
            <input
              value={form.currency}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
              placeholder="INR"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => set('platform', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            >
              <option value="all">All</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="web">Web</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Icon URL</label>
            <input
              value={form.iconUrl}
              onChange={(e) => set('iconUrl', e.target.value)}
              placeholder="/assets/iap/coins_1000.png"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="accent-indigo-500"
            />
            Active (visible to players)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => set('isFeatured', e.target.checked)}
              className="accent-indigo-500"
            />
            Featured
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Product'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : products.length === 0 ? (
        <p className="text-slate-500">No products yet. Add one above.</p>
      ) : (
        <div className="space-y-8">
          <ProductSection title="Coin Packs" items={coinPacks} onEdit={startEdit} onDelete={remove} />
          <ProductSection title="Gem Packs" items={gemPacks} onEdit={startEdit} onDelete={remove} />
          {bundles.length > 0 && (
            <ProductSection title="Bundles (coins + gems)" items={bundles} onEdit={startEdit} onDelete={remove} />
          )}
        </div>
      )}
    </div>
  );
}

function ProductSection({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  items: IAPProduct[];
  onEdit: (p: IAPProduct) => void;
  onDelete: (productId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-300 mb-3">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div key={p.productId} className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-100">{p.name}</span>
              {p.isFeatured && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
                  Featured
                </span>
              )}
              {!p.isActive && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-mono">{p.productId}</p>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              {p.coinsAmount > 0 && (
                <span className="text-sm text-amber-400">{p.coinsAmount.toLocaleString()} coins</span>
              )}
              {p.gemsAmount > 0 && (
                <span className="text-sm text-purple-400">
                  {p.gemsAmount.toLocaleString()} gems
                  {p.bonusGems > 0 && ` (+${p.bonusGems})`}
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-bold text-emerald-400">
              {p.currency} {p.price.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500">Platform: {p.platform}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onEdit(p)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(p.productId)}
                className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-xs hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
