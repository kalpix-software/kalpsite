'use client';

import { useState, useEffect, useCallback } from 'react';
import { ImageIcon, Plus, Trash2, Upload, RefreshCw } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

// Backgrounds live in their own top-level catalog category. They are NOT spine-driven:
// each option carries an assetUrl (full-res image rendered behind the avatar) and a
// previewUrl (picker thumbnail). No skinName — the client renders by category key.
const BACKGROUND_CATEGORY_KEY = 'background';
const BACKGROUND_CATEGORY_LABEL = 'Background';

// ─── Types ───

type AvatarListItem = {
  avatarId: string;
  slug: string;
  avatarName: string;
  previewUrl?: string;
  isActive: boolean;
};

type CurrencyType = 'coins' | 'gems';

type BgOption = {
  optionId: string;
  label: string;
  assetUrl: string;   // full-res background (required)
  previewUrl: string; // picker thumbnail; falls back to assetUrl when empty
  currencyType: CurrencyType;
  price: number;
  salePrice: number;
  purchaseLimit: number;
  itemId?: string;
  uploadingAsset?: boolean;
  uploadingThumb?: boolean;
};

type BgSubcategory = { key: string; label: string; options: BgOption[] };

// Shape returned by avatar/get_character_catalog (only the bits we read).
type RawOption = {
  optionId: string; label?: string; assetUrl?: string; previewUrl?: string;
  currencyType?: string; price?: number; discountedPrice?: number; purchaseLimit?: number; itemId?: string;
};
type RawSubcategory = { key: string; label?: string; options?: RawOption[] };
type RawCategory = { key: string; label?: string; subcategories?: RawSubcategory[] };

// ─── Helpers ───

function contentTypeForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif')) return 'image/gif';
  return file.type || 'application/octet-stream';
}

/**
 * Upload a file directly to R2: presign via store/admin_get_upload_url, then browser PUT.
 * Returns the public URL. fileName drives the deterministic R2 key (e.g. bg_1.webp).
 */
async function uploadBackgroundToR2(file: File, slug: string, subcategoryKey: string, fileName: string): Promise<string> {
  const contentType = contentTypeForFile(file);
  const rpcResult = await callAdminRpc('store/admin_get_upload_url', JSON.stringify({
    itemType: 'avatar_background',
    category: slug,
    subcategory: subcategoryKey,
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

function nextOptionId(options: BgOption[]): string {
  let max = 0;
  for (const o of options) {
    const m = /^bg_(\d+)$/.exec(o.optionId);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `bg_${max + 1}`;
}

function emptyOption(options: BgOption[]): BgOption {
  const id = nextOptionId(options);
  return { optionId: id, label: id.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()), assetUrl: '', previewUrl: '', currencyType: 'coins', price: 0, salePrice: 0, purchaseLimit: 1 };
}

// ─── Page ───

export default function AdminBackgroundsPage() {
  const [avatars, setAvatars] = useState<AvatarListItem[]>([]);
  const [slug, setSlug] = useState('');
  const [subcategories, setSubcategories] = useState<BgSubcategory[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [save, setSave] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });

  const loadAvatars = useCallback(async () => {
    try {
      const raw = await callRpc('avatar/admin_list_avatars', '{}');
      const data = unwrapAdminRpcData<{ avatars?: AvatarListItem[] }>(raw);
      setAvatars(data.avatars ?? []);
    } catch (e) {
      setSave({ loading: false, error: e instanceof Error ? e.message : 'Failed to load avatars' });
    }
  }, []);

  useEffect(() => { loadAvatars(); }, [loadAvatars]);

  // When an avatar is selected, load its existing "background" category so the admin
  // can add to / edit it rather than overwriting blindly.
  const loadExistingBackgrounds = useCallback(async (avatarSlug: string) => {
    if (!avatarSlug) { setSubcategories([]); return; }
    setLoadingCatalog(true);
    try {
      const raw = await callRpc('avatar/get_character_catalog', JSON.stringify({ slug: avatarSlug }));
      const data = unwrapAdminRpcData<{ categories?: RawCategory[] }>(raw);
      const bgCat = (data.categories ?? []).find((c) => c.key === BACKGROUND_CATEGORY_KEY);
      const subs: BgSubcategory[] = (bgCat?.subcategories ?? []).map((s) => ({
        key: s.key,
        label: s.label || s.key,
        options: (s.options ?? []).map((o) => ({
          optionId: o.optionId,
          label: o.label || o.optionId,
          assetUrl: o.assetUrl || '',
          previewUrl: o.previewUrl || '',
          currencyType: (o.currencyType === 'gems' ? 'gems' : 'coins') as CurrencyType,
          price: o.price ?? 0,
          salePrice: o.discountedPrice ?? 0,
          purchaseLimit: o.purchaseLimit && o.purchaseLimit > 0 ? o.purchaseLimit : 1,
          itemId: o.itemId,
        })),
      }));
      // Always offer at least the default subcategory to start from.
      setSubcategories(subs.length > 0 ? subs : [{ key: BACKGROUND_CATEGORY_KEY, label: BACKGROUND_CATEGORY_LABEL, options: [] }]);
    } catch (e) {
      setSave({ loading: false, error: e instanceof Error ? e.message : 'Failed to load catalog' });
      setSubcategories([{ key: BACKGROUND_CATEGORY_KEY, label: BACKGROUND_CATEGORY_LABEL, options: [] }]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const onSelectAvatar = (newSlug: string) => {
    setSlug(newSlug);
    setSave({ loading: false });
    loadExistingBackgrounds(newSlug);
  };

  // ─── Subcategory / option mutation helpers ───

  const updateSub = (si: number, patch: Partial<BgSubcategory>) =>
    setSubcategories((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));

  const updateOption = (si: number, oi: number, patch: Partial<BgOption>) =>
    setSubcategories((prev) => prev.map((s, i) =>
      i === si ? { ...s, options: s.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : s));

  const addSubcategory = () =>
    setSubcategories((prev) => [...prev, { key: `background_${prev.length + 1}`, label: `Background ${prev.length + 1}`, options: [] }]);

  const removeSubcategory = (si: number) =>
    setSubcategories((prev) => prev.filter((_, i) => i !== si));

  const addOption = (si: number) =>
    setSubcategories((prev) => prev.map((s, i) => (i === si ? { ...s, options: [...s.options, emptyOption(s.options)] } : s)));

  const removeOption = (si: number, oi: number) =>
    setSubcategories((prev) => prev.map((s, i) => (i === si ? { ...s, options: s.options.filter((_, j) => j !== oi) } : s)));

  const handleAssetUpload = async (si: number, oi: number, file: File) => {
    const sub = subcategories[si];
    const opt = sub.options[oi];
    if (!slug) { setSave({ loading: false, error: 'Select an avatar first.' }); return; }
    if (!opt.optionId) { setSave({ loading: false, error: 'Set an option id before uploading.' }); return; }
    updateOption(si, oi, { uploadingAsset: true });
    try {
      const url = await uploadBackgroundToR2(file, slug, sub.key, opt.optionId);
      // Default previewUrl to the same image so a single upload is enough.
      updateOption(si, oi, { assetUrl: url, previewUrl: opt.previewUrl || url, uploadingAsset: false });
    } catch (e) {
      updateOption(si, oi, { uploadingAsset: false });
      setSave({ loading: false, error: e instanceof Error ? e.message : 'Upload failed' });
    }
  };

  const handleThumbUpload = async (si: number, oi: number, file: File) => {
    const sub = subcategories[si];
    const opt = sub.options[oi];
    if (!slug || !opt.optionId) { setSave({ loading: false, error: 'Select an avatar and set an option id first.' }); return; }
    updateOption(si, oi, { uploadingThumb: true });
    try {
      const url = await uploadBackgroundToR2(file, slug, sub.key, `${opt.optionId}_thumb`);
      updateOption(si, oi, { previewUrl: url, uploadingThumb: false });
    } catch (e) {
      updateOption(si, oi, { uploadingThumb: false });
      setSave({ loading: false, error: e instanceof Error ? e.message : 'Thumbnail upload failed' });
    }
  };

  // ─── Save ───

  const validate = (): string | null => {
    if (!slug) return 'Select an avatar.';
    const usableSubs = subcategories.filter((s) => s.options.length > 0);
    if (usableSubs.length === 0) return 'Add at least one background option.';
    const subKeys = new Set<string>();
    for (const s of subcategories) {
      if (s.options.length === 0) continue;
      if (!s.key.trim()) return 'Every subcategory needs a key.';
      if (subKeys.has(s.key)) return `Duplicate subcategory key "${s.key}".`;
      subKeys.add(s.key);
      const optIds = new Set<string>();
      for (const o of s.options) {
        if (!o.optionId.trim()) return `An option in "${s.key}" is missing an id.`;
        if (optIds.has(o.optionId)) return `Duplicate option id "${o.optionId}" in "${s.key}".`;
        optIds.add(o.optionId);
        if (!o.assetUrl) return `Option "${o.optionId}" has no uploaded background image.`;
      }
    }
    return null;
  };

  const saveToDatabase = async () => {
    const err = validate();
    if (err) { setSave({ loading: false, error: err }); return; }
    setSave({ loading: true });
    try {
      const usableSubs = subcategories.filter((s) => s.options.length > 0);

      // Step 1: merge the background category via catalogPatch (leaves the spine catalog untouched).
      const patchPayload = {
        avatars: [{
          slug,
          catalogPatch: {
            replaceSubcategories: usableSubs.map((s) => ({
              categoryKey: BACKGROUND_CATEGORY_KEY,
              categoryLabel: BACKGROUND_CATEGORY_LABEL,
              subcategoryKey: s.key,
              label: s.label || s.key,
              options: s.options.map((o) => ({
                optionId: o.optionId,
                label: o.label || o.optionId,
                assetUrl: o.assetUrl,
                previewUrl: o.previewUrl || o.assetUrl,
                currencyType: o.currencyType,
                price: o.price,
                ...(o.salePrice > 0 ? { discountedPrice: o.salePrice } : {}),
                purchaseLimit: o.purchaseLimit,
              })),
            })),
          },
        }],
      };
      await callRpc('avatar/sync_avatars', JSON.stringify(patchPayload));

      // Step 2: re-fetch to resolve itemIds (store items are created during sync).
      const raw = await callRpc('avatar/get_character_catalog', JSON.stringify({ slug }));
      const data = unwrapAdminRpcData<{ categories?: RawCategory[] }>(raw);
      const bgCat = (data.categories ?? []).find((c) => c.key === BACKGROUND_CATEGORY_KEY);
      const itemIdByKey = new Map<string, string>();
      for (const s of bgCat?.subcategories ?? []) {
        for (const o of s.options ?? []) {
          if (o.itemId) itemIdByKey.set(`${s.key}/${o.optionId}`, o.itemId);
        }
      }

      // Step 3: lock prices/discounts/limits via admin_update_item.
      let updated = 0, failed = 0;
      for (const s of usableSubs) {
        for (const o of s.options) {
          const itemId = itemIdByKey.get(`${s.key}/${o.optionId}`);
          if (!itemId) { failed++; continue; }
          const coins = o.currencyType === 'coins' ? o.price : 0;
          const gems = o.currencyType === 'gems' ? o.price : 0;
          const discCoins = o.currencyType === 'coins' ? o.salePrice : 0;
          const discGems = o.currencyType === 'gems' ? o.salePrice : 0;
          try {
            await callRpc('store/admin_update_item', JSON.stringify({
              itemId,
              price: { coins, gems },
              discountedPriceCoins: discCoins,
              discountedPriceGems: discGems,
              metadata: { purchaseLimit: String(o.purchaseLimit) },
            }));
            updated++;
          } catch (e) {
            console.warn(`Failed to update price for ${itemId}:`, e);
            failed++;
          }
        }
      }

      setSave({
        loading: false,
        result: failed > 0 ? `Saved ${updated} backgrounds, ${failed} price update(s) failed (see console).` : `All ${updated} backgrounds saved.`,
      });
      // Reload to pick up itemIds.
      loadExistingBackgrounds(slug);
    } catch (e) {
      setSave({ loading: false, error: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm';
  const fileCls = 'w-full text-sm text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600';

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <ImageIcon className="w-5 h-5" /> Avatar Backgrounds
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Upload backgrounds for an avatar, independent of Spine assets. These become a <code className="bg-slate-700 px-1 rounded">background</code> category in the avatar catalog. Each option is a purchasable store item.
        </p>
      </div>

      {/* Avatar picker */}
      <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Avatar</label>
            <select value={slug} onChange={(e) => onSelectAvatar(e.target.value)} className={inputCls}>
              <option value="">Select an avatar…</option>
              {avatars.map((a) => (
                <option key={a.avatarId} value={a.slug}>{a.avatarName || a.slug} ({a.slug})</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={loadAvatars} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        {loadingCatalog && <p className="mt-2 text-xs text-slate-400">Loading existing backgrounds…</p>}
      </div>

      {/* Subcategories + options */}
      {slug && subcategories.map((sub, si) => (
        <div key={si} className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
          <div className="flex items-end gap-3">
            <div className="w-48">
              <label className="block text-xs text-slate-400 mb-1">Subcategory key</label>
              <input value={sub.key} onChange={(e) => updateSub(si, { key: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Subcategory label</label>
              <input value={sub.label} onChange={(e) => updateSub(si, { label: e.target.value })} className={inputCls} />
            </div>
            {subcategories.length > 1 && (
              <button type="button" onClick={() => removeSubcategory(si)} className="px-3 py-2 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-900 flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            )}
          </div>

          {/* Option rows */}
          <div className="space-y-3">
            {sub.options.map((opt, oi) => (
              <div key={oi} className="rounded-lg border border-slate-600 p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                <div className="lg:col-span-2">
                  {opt.assetUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={opt.previewUrl || opt.assetUrl} alt={opt.optionId} className="w-full h-20 object-cover rounded-md border border-slate-600" />
                  ) : (
                    <div className="w-full h-20 rounded-md border border-dashed border-slate-600 flex items-center justify-center text-slate-500 text-xs">No image</div>
                  )}
                </div>
                <div className="lg:col-span-3 space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Option id</label>
                    <input value={opt.optionId} onChange={(e) => updateOption(si, oi, { optionId: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Label</label>
                    <input value={opt.label} onChange={(e) => updateOption(si, oi, { label: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div className="lg:col-span-3 space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Background image (full-res)</label>
                    <input type="file" accept=".webp,.png,.jpg,.jpeg,.gif" disabled={opt.uploadingAsset} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAssetUpload(si, oi, f); }} className={fileCls} />
                    {opt.uploadingAsset && <p className="text-[11px] text-slate-400 mt-1">Uploading…</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Thumbnail (optional)</label>
                    <input type="file" accept=".webp,.png,.jpg,.jpeg,.gif" disabled={opt.uploadingThumb} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThumbUpload(si, oi, f); }} className={fileCls} />
                    {opt.uploadingThumb && <p className="text-[11px] text-slate-400 mt-1">Uploading…</p>}
                  </div>
                </div>
                <div className="lg:col-span-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Currency</label>
                    <select value={opt.currencyType} onChange={(e) => updateOption(si, oi, { currencyType: e.target.value as CurrencyType })} className={inputCls}>
                      <option value="coins">coins</option>
                      <option value="gems">gems</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Price</label>
                    <input type="number" min={0} value={opt.price} onChange={(e) => updateOption(si, oi, { price: Math.max(0, parseInt(e.target.value, 10) || 0) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Sale price</label>
                    <input type="number" min={0} value={opt.salePrice} onChange={(e) => updateOption(si, oi, { salePrice: Math.max(0, parseInt(e.target.value, 10) || 0) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Limit</label>
                    <input type="number" min={1} value={opt.purchaseLimit} onChange={(e) => updateOption(si, oi, { purchaseLimit: Math.max(1, parseInt(e.target.value, 10) || 1) })} className={inputCls} />
                  </div>
                </div>
                <div className="lg:col-span-1 flex lg:justify-end">
                  <button type="button" onClick={() => removeOption(si, oi)} className="px-2 py-2 rounded-lg bg-red-900/60 text-red-200 hover:bg-red-900" title="Remove option">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => addOption(si)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add background
          </button>
        </div>
      ))}

      {slug && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={addSubcategory} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add subcategory
          </button>
          <button type="button" onClick={saveToDatabase} disabled={save.loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1">
            <Upload className="w-4 h-4" /> {save.loading ? 'Saving…' : 'Save backgrounds'}
          </button>
        </div>
      )}

      {save.result && <p className="text-sm text-green-400">{save.result}</p>}
      {save.error && <p className="text-sm text-red-400">{save.error}</p>}
    </div>
  );
}
