'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, RefreshCw, List } from 'lucide-react';
import { callAdminRpc } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

type AvatarListItem = {
  avatarId: string;
  slug: string;
  avatarName: string;
  previewUrl?: string;
  isActive: boolean;
  sortOrder?: number;
};

type CatalogOption = { optionId: string; label: string; previewUrl?: string; skinName?: string; price?: { coins: number; gems: number } };
type CatalogSubcategory = { key: string; label: string; options: CatalogOption[] };
type CatalogCategory = { key: string; label: string; subcategories: CatalogSubcategory[] };
type CatalogPart = { defaultSelection?: Record<string, string>; categories: CatalogCategory[] };
type AvatarCatalogEntry = { slug: string; avatarName: string; catalog?: CatalogPart; categories?: CatalogCategory[] };
type RawCatalogBundle = { avatars: AvatarCatalogEntry[] };

type PriceRow = { slug: string; categoryKey: string; subcategoryKey: string; optionId: string; label: string; coins: number; gems: number; rowKey: string };

/** Normalize single-file format (slug, avatarName, categories) or bundle (avatars[]) to { avatars: [ { slug, avatarName, catalog: { categories } } ] }. */
function normalizeToBundle(data: unknown): RawCatalogBundle {
  const obj = data as Record<string, unknown>;
  if (obj.avatars && Array.isArray(obj.avatars)) {
    const avatars = (obj.avatars as AvatarCatalogEntry[]).map((a) => {
      const categories = a.catalog?.categories ?? a.categories ?? [];
      return { slug: a.slug, avatarName: a.avatarName, catalog: { defaultSelection: a.catalog?.defaultSelection, categories } };
    });
    return { avatars };
  }
  if (obj.slug && obj.categories && Array.isArray(obj.categories)) {
    return {
      avatars: [
        {
          slug: String(obj.slug),
          avatarName: String((obj as { avatarName?: string }).avatarName || obj.slug),
          catalog: { categories: obj.categories as CatalogCategory[] },
        },
      ],
    };
  }
  throw new Error('JSON must be a catalog file (slug, avatarName, categories) or a bundle ({ avatars: [...] }).');
}

function flattenToPriceRows(avatars: RawCatalogBundle['avatars']): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const av of avatars) {
    const categories = av.catalog?.categories ?? av.categories ?? [];
    for (const cat of categories) {
      for (const sub of cat.subcategories ?? []) {
        for (const opt of sub.options ?? []) {
          rows.push({
            slug: av.slug,
            categoryKey: cat.key,
            subcategoryKey: sub.key,
            optionId: opt.optionId,
            label: opt.label,
            coins: opt.price?.coins ?? 0,
            gems: opt.price?.gems ?? 0,
            rowKey: `${av.slug}|${cat.key}|${sub.key}|${opt.optionId}`,
          });
        }
      }
    }
  }
  return rows;
}

function applyPricesToCatalog(avatars: RawCatalogBundle['avatars'], priceRows: PriceRow[]): RawCatalogBundle {
  const byKey = new Map(priceRows.map((r) => [r.rowKey, r]));
  const out: AvatarCatalogEntry[] = avatars.map((av) => {
    const categories = av.catalog?.categories ?? av.categories ?? [];
    return {
      slug: av.slug,
      avatarName: av.avatarName,
      catalog: {
        defaultSelection: av.catalog?.defaultSelection,
        categories: categories.map((cat) => ({
          ...cat,
          subcategories: (cat.subcategories ?? []).map((sub) => ({
            ...sub,
            options: (sub.options ?? []).map((opt) => {
              const rowKey = `${av.slug}|${cat.key}|${sub.key}|${opt.optionId}`;
              const row = byKey.get(rowKey);
              return { ...opt, price: row ? { coins: row.coins, gems: row.gems } : opt.price };
            }),
          })),
        })),
      },
    };
  });
  return { avatars: out };
}

export default function AdminAvatarsPage() {
  const [catalogRaw, setCatalogRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<RawCatalogBundle | null>(null);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listAvatars, setListAvatars] = useState<AvatarListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadAvatarList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await callRpc('avatar/admin_list_avatars', '{}');
      const raw = (data as { data?: { avatars?: AvatarListItem[] }; avatars?: AvatarListItem[] })?.data ?? data;
      const avatars = raw?.avatars ?? [];
      setListAvatars(Array.isArray(avatars) ? avatars : []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to load avatar list');
      setListAvatars([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAvatarList();
  }, [loadAvatarList]);

  const setAvatarActive = async (avatarId: string, isActive: boolean) => {
    setTogglingId(avatarId);
    try {
      await callRpc('avatar/admin_set_avatar_active', JSON.stringify({ avatarId, isActive }));
      setListAvatars((prev) => prev.map((a) => (a.avatarId === avatarId ? { ...a, isActive } : a)));
    } catch {
      setListError('Failed to update active state');
    } finally {
      setTogglingId(null);
    }
  };

  const parseCatalog = () => {
    setParseError(null);
    setParsed(null);
    setPriceRows([]);
    const raw = catalogRaw.trim();
    if (!raw) {
      setParseError('Paste JSON or upload a catalog file.');
      return;
    }
    try {
      const data = JSON.parse(raw) as unknown;
      const bundle = normalizeToBundle(data);
      if (!bundle.avatars.length) {
        setParseError('No avatars or categories found in the JSON.');
        return;
      }
      setParsed(bundle);
      setPriceRows(flattenToPriceRows(bundle.avatars));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const setPriceRow = (rowKey: string, field: 'coins' | 'gems', value: number) => {
    setPriceRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, [field]: value } : r)));
  };

  const saveToDatabase = async () => {
    if (!parsed || priceRows.length === 0) {
      setSaveStatus({ error: 'Parse a catalog first, then save.' });
      return;
    }
    setSaveStatus({ loading: true });
    try {
      const payload = applyPricesToCatalog(parsed.avatars, priceRows);
      await callRpc('avatar/sync_avatars', JSON.stringify(payload));
      setSaveStatus({ loading: false, result: 'Saved to database. Avatar list, catalog, and store items are updated.' });
      loadAvatarList();
    } catch (e) {
      setSaveStatus({ loading: false, error: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCatalogRaw(text);
      setParseError(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Avatars</h1>
      <p className="text-slate-400 text-sm mb-6">
        Upload a catalog JSON file (e.g. <code className="bg-slate-700 px-1 rounded">avatar1.json</code> from kalpix-avatars). It will be parsed into a table with empty prices. Fill in coins/gems and save to the database. Toggle which avatars appear in the app below.
      </p>

      <div className="max-w-4xl space-y-4">
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <h2 className="font-medium text-slate-100 mb-2 flex items-center gap-2">
            <List className="w-4 h-4" />
            Avatar list (active = shown in app)
          </h2>
          <p className="text-slate-400 text-xs mb-3">
            Only avatars marked active appear in <code className="bg-slate-700 px-1 rounded">avatar/list_avatars</code>. Toggle to show or hide each avatar in the app.
          </p>
          {listError && <p className="text-sm text-red-400 mb-2">{listError}</p>}
          {listLoading ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={loadAvatarList}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-600">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700 text-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2">Slug</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2 w-24">Active</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {listAvatars.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-slate-500 text-center">
                          No avatars in database. Upload a catalog and save below.
                        </td>
                      </tr>
                    ) : (
                      listAvatars.map((a) => (
                        <tr key={a.avatarId} className="border-t border-slate-600 hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-mono text-xs">{a.slug}</td>
                          <td className="px-3 py-2">{a.avatarName}</td>
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={a.isActive}
                                disabled={togglingId === a.avatarId}
                                onChange={(e) => setAvatarActive(a.avatarId, e.target.checked)}
                                className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className={a.isActive ? 'text-green-400' : 'text-slate-500'}>
                                {togglingId === a.avatarId ? '…' : a.isActive ? 'Yes' : 'No'}
                              </span>
                            </label>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <h2 className="font-medium text-slate-100 mb-2 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Catalog JSON
          </h2>
          <div className="flex flex-wrap gap-2 mb-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={onFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600"
            >
              Upload file (e.g. avatar1.json)
            </button>
            <span className="text-slate-500 text-sm self-center">or paste JSON below</span>
          </div>
          <textarea
            value={catalogRaw}
            onChange={(e) => {
              setCatalogRaw(e.target.value);
              setParseError(null);
            }}
            placeholder='Paste catalog JSON (e.g. { "slug": "avatar1", "avatarName": "Avatar1", "categories": [ ... ] })'
            className="w-full h-28 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm font-mono placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={parseCatalog}
            className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
          >
            Parse
          </button>
          {parsed && (
            <span className="ml-3 text-slate-400 text-sm">
              {parsed.avatars.length} avatar(s), {priceRows.length} option(s)
            </span>
          )}
          {parseError && <p className="mt-2 text-sm text-red-400">{parseError}</p>}
        </div>

        {priceRows.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <h2 className="font-medium text-slate-100 mb-3">Prices (fill in and save)</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-600 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700 text-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5">Avatar</th>
                    <th className="text-left px-2 py-1.5">Category</th>
                    <th className="text-left px-2 py-1.5">Subcategory</th>
                    <th className="text-left px-2 py-1.5">Option</th>
                    <th className="text-left px-2 py-1.5">Label</th>
                    <th className="text-left w-24">Coins</th>
                    <th className="text-left w-24">Gems</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {priceRows.map((r) => (
                    <tr key={r.rowKey} className="border-t border-slate-600">
                      <td className="px-2 py-1">{r.slug}</td>
                      <td className="px-2 py-1">{r.categoryKey}</td>
                      <td className="px-2 py-1">{r.subcategoryKey}</td>
                      <td className="px-2 py-1 font-mono text-xs">{r.optionId}</td>
                      <td className="px-2 py-1">{r.label}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          value={r.coins}
                          onChange={(e) => setPriceRow(r.rowKey, 'coins', parseInt(e.target.value, 10) || 0)}
                          className="w-20 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-100"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          value={r.gems}
                          onChange={(e) => setPriceRow(r.rowKey, 'gems', parseInt(e.target.value, 10) || 0)}
                          className="w-20 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={saveToDatabase}
              disabled={saveStatus.loading}
              className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {saveStatus.loading ? 'Saving…' : 'Save to database'}
            </button>
            {saveStatus.result && <p className="mt-2 text-sm text-green-400">{saveStatus.result}</p>}
            {saveStatus.error && <p className="mt-2 text-sm text-red-400">{saveStatus.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
