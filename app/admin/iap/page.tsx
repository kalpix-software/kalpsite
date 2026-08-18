'use client';

import { useCallback, useEffect, useState } from 'react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

/**
 * Upload a PNG/WebP icon to R2 via the presigned-URL flow and return its full
 * public CDN URL. subcategory groups the object: "products" | "promos".
 */
async function uploadIapIcon(file: File, subcategory: string): Promise<string> {
  const contentType = file.type; // "image/png" | "image/webp"
  const rpc = await callAdminRpc(
    'store/admin_get_upload_url',
    JSON.stringify({ itemType: 'iap_icon', subcategory, contentType }),
  );
  const data = unwrapAdminRpcData<{ uploadUrl?: string; publicUrl?: string }>(rpc);
  if (!data?.uploadUrl || !data?.publicUrl) throw new Error('Failed to get upload URL from backend');
  const put = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return data.publicUrl; // full URL
}

/** Image upload control: pick a PNG/WebP → uploads → reports the full URL. */
function IconUpload({
  value,
  subcategory,
  onUploaded,
}: {
  value: string;
  subcategory: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/webp') {
      setErr('Please choose a PNG or WebP image');
      return;
    }
    setErr('');
    setUploading(true);
    try {
      onUploaded(await uploadIapIcon(file, subcategory));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="icon"
          className="h-12 w-12 rounded-lg object-cover bg-slate-900 border border-slate-700"
        />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-slate-900 border border-slate-700 grid place-items-center text-[10px] text-slate-600">
          none
        </div>
      )}
      <label className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 cursor-pointer">
        {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload PNG/WebP'}
        <input
          type="file"
          accept="image/png,image/webp"
          onChange={onPick}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {value && (
        <button
          type="button"
          onClick={() => onUploaded('')}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Remove
        </button>
      )}
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}

interface IAPProduct {
  productId: string;
  name: string;
  description: string;
  coinsAmount: number;
  bonusCoins: number;
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
  bonusCoins: 0,
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

      <PromoManager />

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
            <label className="block text-xs text-slate-500 mb-1">Bonus coins</label>
            <input
              type="number"
              value={form.bonusCoins}
              onChange={(e) => set('bonusCoins', Number(e.target.value))}
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
            <label className="block text-xs text-slate-500 mb-1">Icon (PNG or WebP)</label>
            <IconUpload
              value={form.iconUrl}
              subcategory="products"
              onUploaded={(url) => set('iconUrl', url)}
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

interface PromoBanner {
  promoId: string;
  title: string;
  subtitle: string;
  badgeText: string;
  iconUrl: string;
  isActive: boolean;
  startsAt: number; // unix secs, 0 = no bound
  endsAt: number;
  createdAt?: number;
  updatedAt?: number;
}

const EMPTY_PROMO: PromoBanner = {
  promoId: '',
  title: '',
  subtitle: '',
  badgeText: '',
  iconUrl: '',
  isActive: true,
  startsAt: 0,
  endsAt: 0,
};

// Convert unix seconds <-> the value a <input type="datetime-local"> expects (local time).
function toLocalInput(unix: number): string {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(s: string): number {
  if (!s) return 0;
  return Math.floor(new Date(s).getTime() / 1000);
}

function promoIsLive(p: PromoBanner): boolean {
  if (!p.isActive) return false;
  const now = Math.floor(Date.now() / 1000);
  if (p.startsAt > 0 && now < p.startsAt) return false;
  if (p.endsAt > 0 && now > p.endsAt) return false;
  return true;
}

function PromoManager() {
  const [promos, setPromos] = useState<PromoBanner[]>([]);
  const [form, setForm] = useState<PromoBanner>(EMPTY_PROMO);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = (await callAdminRpc('store/admin_get_iap_promos')) as {
        data?: { promos?: PromoBanner[] };
        promos?: PromoBanner[];
      };
      const d = res?.data ?? res;
      setPromos(d?.promos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load promos');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof PromoBanner>(key: K, value: PromoBanner[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setForm(EMPTY_PROMO);
    setEditingId(null);
    setError('');
  };

  const save = async () => {
    if (!form.promoId.trim() || !form.title.trim()) {
      setError('promoId and title are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await callAdminRpc('store/admin_upsert_iap_promo', JSON.stringify(form));
      reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (promoId: string) => {
    if (!confirm(`Delete promo "${promoId}"?`)) return;
    try {
      await callAdminRpc('store/admin_delete_iap_promo', JSON.stringify({ promoId }));
      if (editingId === promoId) reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 mb-8 max-w-3xl">
      <h2 className="text-sm font-semibold text-slate-300 mb-1">Promo Banner</h2>
      <p className="text-xs text-slate-500 mb-3">
        Display-only banner shown on the IAP screen (e.g. &quot;Weekend Double Bonus&quot;). Does not change
        granted amounts — set bonus coins/gems on the packs for real bonuses.
      </p>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Promo ID *</label>
          <input
            value={form.promoId}
            onChange={(e) => set('promoId', e.target.value)}
            disabled={!!editingId}
            placeholder="e.g. weekend_double_bonus"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Badge text</label>
          <input
            value={form.badgeText}
            onChange={(e) => set('badgeText', e.target.value)}
            placeholder="2×"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Title *</label>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Weekend Double Bonus!"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Subtitle</label>
          <input
            value={form.subtitle}
            onChange={(e) => set('subtitle', e.target.value)}
            placeholder="Get 2× bonus on every pack · Ends Sunday"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Icon (PNG or WebP)</label>
          <IconUpload
            value={form.iconUrl}
            subcategory="promos"
            onUploaded={(url) => set('iconUrl', url)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Starts (optional)</label>
          <input
            type="datetime-local"
            value={toLocalInput(form.startsAt)}
            onChange={(e) => set('startsAt', fromLocalInput(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Ends (optional)</label>
          <input
            type="datetime-local"
            value={toLocalInput(form.endsAt)}
            onChange={(e) => set('endsAt', fromLocalInput(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className="accent-indigo-500"
          />
          Active
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Banner'}
        </button>
        {editingId && (
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
          >
            Cancel
          </button>
        )}
      </div>

      {promos.length > 0 && (
        <div className="mt-5 space-y-2">
          {promos.map((p) => (
            <div
              key={p.promoId}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-700"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100 truncate">{p.title}</span>
                  {p.badgeText && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
                      {p.badgeText}
                    </span>
                  )}
                  {promoIsLive(p) ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">
                      Live
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                      {p.isActive ? 'Scheduled/Expired' : 'Inactive'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{p.subtitle || p.promoId}</p>
              </div>
              <button
                onClick={() => {
                  setForm(p);
                  setEditingId(p.promoId);
                  setError('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
              >
                Edit
              </button>
              <button
                onClick={() => remove(p.promoId)}
                className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-xs hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          ))}
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
                <span className="text-sm text-amber-400">
                  {p.coinsAmount.toLocaleString()} coins
                  {p.bonusCoins > 0 && ` (+${p.bonusCoins})`}
                </span>
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
