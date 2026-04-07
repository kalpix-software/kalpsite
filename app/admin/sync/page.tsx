'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, RefreshCw, List, Image } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

// ─── Types ───

type AvatarListItem = {
  avatarId: string;
  slug: string;
  avatarName: string;
  previewUrl?: string;
  isActive: boolean;
  sortOrder?: number;
};

type CatalogOption = { optionId: string; label: string; previewUrl?: string; skinName?: string; currencyType?: string; price?: number; purchaseLimit?: number };
type CatalogSubcategory = { key: string; label: string; options: CatalogOption[] };
type CatalogCategory = { key: string; label: string; subcategories: CatalogSubcategory[] };
type CatalogPart = { defaultSelection?: Record<string, string>; categories: CatalogCategory[] };
type AvatarCatalogEntry = { slug: string; avatarName: string; catalog?: CatalogPart; categories?: CatalogCategory[] };
type RawCatalogBundle = { avatars: AvatarCatalogEntry[] };

type PriceRow = { slug: string; categoryKey: string; subcategoryKey: string; optionId: string; label: string; currencyType: string; price: number; purchaseLimit: number; rowKey: string };

// ─── Category assignment types ───
type SubcategoryAssignment = { subcategoryKey: string; categoryKey: string; categoryLabel: string };
type CustomCategory = { key: string; label: string };

// ─── Spine JSON parsing (mirrors kalpix-avatars/scripts/create_avatars_catalog logic) ───

type SpineSkin = { name: string };
type SpineAsset = { skins?: SpineSkin[]; animations?: Record<string, unknown> };

const BODY_KEYS = ['face', 'eyes', 'eyebrow', 'hair', 'lips'];
const FASHION_KEYS = ['dress', 'shoes', 'watch', 'fan'];
const BODY_ORDER = ['face', 'eyes', 'eyebrow', 'hair', 'lips'];
const FASHION_ORDER = ['dress', 'shoes', 'watch', 'fan'];

function humanize(s: string): string {
  return s
    .replace(/_/g, ' ')
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

/** R2 key for Spine atlas: `.txt` by default; `.atlas` if the selected file uses that extension. */
function spineAtlasObjectKey(slug: string, file: File): string {
  const n = file.name.toLowerCase();
  if (n.endsWith('.atlas')) return `${slug}.atlas`;
  return `${slug}.txt`;
}

function topCategory(subKey: string): 'body' | 'fashion' | 'animation' | 'others' {
  const lower = subKey.toLowerCase();
  if (BODY_KEYS.includes(lower)) return 'body';
  if (FASHION_KEYS.includes(lower)) return 'fashion';
  if (lower === 'animation') return 'animation';
  return 'others';
}

function naturalSort(a: string, b: string): number {
  const na = trailingNumber(a);
  const nb = trailingNumber(b);
  if (na >= 0 && nb >= 0) return na - nb;
  if (na >= 0) return -1;
  if (nb >= 0) return 1;
  return a.localeCompare(b);
}

function trailingNumber(optionId: string): number {
  const idx = optionId.lastIndexOf('_');
  if (idx < 0 || idx === optionId.length - 1) return -1;
  const n = parseInt(optionId.slice(idx + 1), 10);
  return isNaN(n) ? -1 : n;
}

/** Parse Spine JSON and build catalog categories (same logic as the Go create_avatars_catalog script). */
function buildCatalogFromSpine(spineJson: SpineAsset, slug: string): CatalogCategory[] {
  const subcategoryOptions: Record<string, string[]> = {};

  // Extract skins with "subcategory/optionId" pattern
  for (const skin of spineJson.skins ?? []) {
    const name = skin.name?.trim();
    if (!name || name.toLowerCase() === 'default' || !name.includes('/')) continue;
    const [left, right] = name.split('/', 2).map((s) => s.trim());
    if (!left || !right) continue;
    if (!subcategoryOptions[left]) subcategoryOptions[left] = [];
    if (!subcategoryOptions[left].includes(right)) subcategoryOptions[left].push(right);
  }

  // Extract animations
  if (spineJson.animations) {
    const animOpts = Object.keys(spineJson.animations)
      .filter((k) => k.trim().toLowerCase() !== 'default')
      .sort();
    if (animOpts.length > 0) subcategoryOptions['animation'] = animOpts;
  }

  // Sort options naturally
  for (const key of Object.keys(subcategoryOptions)) {
    subcategoryOptions[key].sort(naturalSort);
  }

  // Group by top category
  const groups: Record<string, Record<string, string[]>> = { body: {}, fashion: {}, animation: {}, others: {} };
  for (const [key, opts] of Object.entries(subcategoryOptions)) {
    groups[topCategory(key)][key] = opts;
  }

  function buildSubcategories(order: string[], all: Record<string, string[]>, isAnimation: boolean): CatalogSubcategory[] {
    const seen = new Set<string>();
    const result: CatalogSubcategory[] = [];
    for (const k of order) {
      if (!all[k] || seen.has(k)) continue;
      seen.add(k);
      result.push({
        key: k,
        label: k,
        options: all[k].map((oid) => ({
          optionId: oid,
          label: humanize(oid),
          ...(!isAnimation ? { skinName: `${k}/${oid}` } : {}),
          // Same path pattern as cosmetic previews so R2 uploads (subcategory/optionId.webp) match after sync.
          previewUrl: `avatars/${slug}/previews/${k}/${oid}.webp`,
        })),
      });
    }
    // Remaining keys not in order
    for (const [k, opts] of Object.entries(all)) {
      if (seen.has(k)) continue;
      result.push({
        key: k,
        label: k,
        options: opts.map((oid) => ({
          optionId: oid,
          label: humanize(oid),
          ...(!isAnimation ? { skinName: `${k}/${oid}` } : {}),
          previewUrl: `avatars/${slug}/previews/${k}/${oid}.webp`,
        })),
      });
    }
    return result;
  }

  const categories: CatalogCategory[] = [];
  if (Object.keys(groups.body).length > 0) {
    categories.push({ key: 'body', label: 'Body', subcategories: buildSubcategories(BODY_ORDER, groups.body, false) });
  }
  if (Object.keys(groups.fashion).length > 0) {
    categories.push({ key: 'fashion', label: 'Fashion', subcategories: buildSubcategories(FASHION_ORDER, groups.fashion, false) });
  }
  if (Object.keys(groups.animation).length > 0) {
    categories.push({ key: 'animation', label: 'Animation', subcategories: buildSubcategories(['animation'], groups.animation, true) });
  }
  if (Object.keys(groups.others).length > 0) {
    categories.push({ key: 'others', label: 'Others', subcategories: buildSubcategories([], groups.others, false) });
  }
  return categories;
}

function buildDefaultSelection(categories: CatalogCategory[]): Record<string, string> {
  const sel: Record<string, string> = {};
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      if (sub.options.length > 0) sel[sub.key] = sub.options[0].optionId;
    }
  }
  return sel;
}

// ─── Catalog normalization (supports legacy JSON paste too) ───

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
          const legacyMax = (opt as { maxQuantityPerUser?: number }).maxQuantityPerUser;
          rows.push({
            slug: av.slug,
            categoryKey: cat.key,
            subcategoryKey: sub.key,
            optionId: opt.optionId,
            label: opt.label,
            currencyType: opt.currencyType ?? 'coins',
            price: opt.price ?? 0,
            purchaseLimit: opt.purchaseLimit ?? legacyMax ?? 1,
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
              const legacyMax = (opt as { maxQuantityPerUser?: number }).maxQuantityPerUser;
              return {
                ...opt,
                currencyType: row ? row.currencyType : (opt.currencyType ?? 'coins'),
                price: row ? row.price : (opt.price ?? 0),
                purchaseLimit: row?.purchaseLimit ?? opt.purchaseLimit ?? legacyMax ?? 1,
              };
            }),
          })),
        })),
      },
    };
  });
  return { avatars: out };
}

// ─── Category assignment helpers ───

const DEFAULT_CATEGORIES: CustomCategory[] = [
  { key: 'body', label: 'Body' },
  { key: 'fashion', label: 'Fashion' },
  { key: 'animation', label: 'Animation' },
  { key: 'others', label: 'Others' },
];

/** Extract subcategory→category assignments from a parsed catalog */
function extractAssignments(categories: CatalogCategory[]): SubcategoryAssignment[] {
  const result: SubcategoryAssignment[] = [];
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      result.push({ subcategoryKey: sub.key, categoryKey: cat.key, categoryLabel: cat.label });
    }
  }
  return result;
}

/** Rebuild catalog categories from the current assignments */
function rebuildCatalogWithAssignments(
  originalCategories: CatalogCategory[],
  currentAssignments: SubcategoryAssignment[],
  allCategories: CustomCategory[],
): CatalogCategory[] {
  // Build a map of subcategoryKey → original subcategory data (with options)
  const subMap = new Map<string, CatalogSubcategory>();
  for (const cat of originalCategories) {
    for (const sub of cat.subcategories) {
      subMap.set(sub.key, sub);
    }
  }

  // Group subcategories by their assigned category
  const grouped = new Map<string, CatalogSubcategory[]>();
  for (const a of currentAssignments) {
    const sub = subMap.get(a.subcategoryKey);
    if (!sub) continue;
    if (!grouped.has(a.categoryKey)) grouped.set(a.categoryKey, []);
    grouped.get(a.categoryKey)!.push(sub);
  }

  // Build output categories in order of allCategories
  const result: CatalogCategory[] = [];
  for (const cat of allCategories) {
    const subs = grouped.get(cat.key);
    if (subs && subs.length > 0) {
      result.push({ key: cat.key, label: cat.label, subcategories: subs });
    }
  }
  return result;
}

// ─── R2 upload helper (proxied through backend — R2 presigned URLs don't work with custom domains) ───

async function uploadFileToR2(file: File, itemType: string, category: string, fileName?: string, subcategory?: string): Promise<string> {
  const form = new FormData();
  form.append('itemType', itemType);
  form.append('category', category);
  form.append('subcategory', subcategory ?? '');
  form.append('fileName', fileName ?? '');
  form.append('file', file, fileName ?? file.name);

  const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error ?? 'Upload failed');
  }
  const data = await res.json();
  if (!data.publicUrl) throw new Error('No publicUrl in upload response');
  return data.publicUrl;
}

// ─── Page Component ───

export default function AdminAvatarsPage() {
  // Spine file upload state
  const [slug, setSlug] = useState('');
  const [spineJsonFile, setSpineJsonFile] = useState<File | null>(null);
  const [spineAtlasFile, setSpineAtlasFile] = useState<File | null>(null);
  const [spineTextureFile, setSpineTextureFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ result?: string; error?: string }>({});

  const [previewSubcategory, setPreviewSubcategory] = useState('');
  const [previewOptionId, setPreviewOptionId] = useState('');
  const [previewSlug, setPreviewSlug] = useState('');
  const [previewUploading, setPreviewUploading] = useState(false);
  const [previewUploadStatus, setPreviewUploadStatus] = useState<{ result?: string; error?: string }>({});
  const previewFileRef = useRef<HTMLInputElement>(null);
  const [previewCatalog, setPreviewCatalog] = useState<CatalogCategory[]>([]);

  // Catalog state (generated from Spine or pasted JSON)
  const [catalogRaw, setCatalogRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<RawCatalogBundle | null>(null);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category assignment state (step between parse and price table)
  const [assignments, setAssignments] = useState<SubcategoryAssignment[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCatKey, setNewCatKey] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [pendingCatalogBundle, setPendingCatalogBundle] = useState<RawCatalogBundle | null>(null);

  // Avatar list state
  const [listAvatars, setListAvatars] = useState<AvatarListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadAvatarList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await callRpc('avatar/admin_list_avatars', '{}') as { data?: { avatars?: AvatarListItem[] }; avatars?: AvatarListItem[] };
      const raw = data?.data ?? data;
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

  const handlePreviewImageUpload = async () => {
    const s = previewSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!s) {
      setPreviewUploadStatus({ error: 'Select an avatar slug.' });
      return;
    }
    const sub = previewSubcategory.trim();
    if (!sub) {
      setPreviewUploadStatus({ error: 'Select a subcategory.' });
      return;
    }
    const optionId = previewOptionId.trim();
    if (!optionId) {
      setPreviewUploadStatus({ error: 'Select an option.' });
      return;
    }
    const file = previewFileRef.current?.files?.[0];
    if (!file) {
      setPreviewUploadStatus({ error: 'Choose a preview image.' });
      return;
    }
    const allowed = ['image/webp', 'image/png', 'image/jpeg', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setPreviewUploadStatus({ error: 'Use WebP, PNG, JPEG, or GIF.' });
      return;
    }
    setPreviewUploading(true);
    setPreviewUploadStatus({});
    try {
      // Use deterministic filename: {optionId}.webp — matches the catalog previewUrl path
      const ext = file.type === 'image/png' ? '.png' : file.type === 'image/jpeg' ? '.jpg' : file.type === 'image/gif' ? '.gif' : '.webp';
      const deterministicFileName = `${optionId}${ext}`;
      const publicUrl = await uploadFileToR2(file, 'avatar_preview', s, deterministicFileName, sub);
      await callRpc(
        'avatar/admin_set_option_preview',
        JSON.stringify({
          slug: s,
          subcategoryKey: sub,
          optionId,
          previewUrl: publicUrl,
        }),
      );
      setPreviewUploadStatus({
        result: `Uploaded ${sub}/${optionId} preview. Catalog updated.`,
      });
      if (previewFileRef.current) previewFileRef.current.value = '';
    } catch (e) {
      setPreviewUploadStatus({ error: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setPreviewUploading(false);
    }
  };

  // Load catalog for an avatar from backend (for preview upload when catalog was saved in a previous session)
  const loadCatalogForPreview = async (avatarSlug: string) => {
    try {
      const raw = await callRpc('avatar/get_character_catalog', JSON.stringify({ slug: avatarSlug }));
      const data = unwrapAdminRpcData<{ categories?: CatalogCategory[] }>(raw);
      const cats = data?.categories ?? [];
      setPreviewCatalog(cats);
      setPreviewSlug(avatarSlug);
      setPreviewSubcategory('');
      setPreviewOptionId('');
    } catch {
      setPreviewUploadStatus({ error: `Failed to load catalog for ${avatarSlug}` });
    }
  };

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

  // ─── Spine file upload + auto-parse ───

  const handleSpineUploadAndParse = async () => {
    if (!slug.trim()) { setUploadStatus({ error: 'Enter an avatar slug (e.g. avatar1)' }); return; }
    if (!spineJsonFile) { setUploadStatus({ error: 'Select the Spine .json file' }); return; }
    if (!spineAtlasFile) { setUploadStatus({ error: 'Select the Spine atlas file (.txt or .atlas)' }); return; }
    if (!spineTextureFile) { setUploadStatus({ error: 'Select the Spine texture image (.webp or .png)' }); return; }

    setUploading(true);
    setUploadStatus({});
    setParseError(null);
    try {
      const s = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // 1. Read and parse the Spine JSON to extract skins/animations
      const jsonText = await spineJsonFile.text();
      const spineData = JSON.parse(jsonText) as SpineAsset;
      const categories = buildCatalogFromSpine(spineData, s);
      if (categories.length === 0) {
        setUploadStatus({ error: 'No skins found in the Spine JSON. Skins must use "subcategory/optionId" naming (e.g. "hair/hair_1").' });
        setUploading(false);
        return;
      }

      // 2. Upload 3 Spine files to R2: avatars/{slug}/spine/{slug}.json, .txt (or .atlas), .webp
      const textureExt = spineTextureFile.name.endsWith('.png') ? '.png' : '.webp';
      const atlasKey = spineAtlasObjectKey(s, spineAtlasFile);
      await Promise.all([
        uploadFileToR2(spineJsonFile, 'avatar_spine', s, `${s}.json`),
        uploadFileToR2(spineAtlasFile, 'avatar_spine', s, atlasKey),
        uploadFileToR2(spineTextureFile, 'avatar_spine', s, `${s}${textureExt}`),
      ]);

      // 3. Build catalog bundle and show category assignment step
      const defaultSelection = buildDefaultSelection(categories);
      const bundle: RawCatalogBundle = {
        avatars: [{
          slug: s,
          avatarName: humanize(s),
          catalog: { defaultSelection, categories },
        }],
      };
      setPendingCatalogBundle(bundle);
      setAssignments(extractAssignments(categories));
      setCustomCategories([...DEFAULT_CATEGORIES]);
      // Clear any previous price table until assignments are confirmed
      setParsed(null);
      setPriceRows([]);
      setUploadStatus({ result: `Spine assets uploaded to R2. ${categories.reduce((n, c) => n + c.subcategories.reduce((m, sub) => m + sub.options.length, 0), 0)} options found. Review category assignments below, then confirm to set prices.` });
    } catch (e) {
      setUploadStatus({ error: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  // ─── Legacy JSON paste (still supported) ───

  const parseCatalog = () => {
    setParseError(null);
    setParsed(null);
    setPriceRows([]);
    const raw = catalogRaw.trim();
    if (!raw) { setParseError('Paste JSON or upload Spine files above.'); return; }
    try {
      const data = JSON.parse(raw) as unknown;
      const bundle = normalizeToBundle(data);
      if (!bundle.avatars.length) { setParseError('No avatars or categories found in the JSON.'); return; }
      // Show assignment step for JSON paste too
      setPendingCatalogBundle(bundle);
      const categories = bundle.avatars[0].catalog?.categories ?? bundle.avatars[0].categories ?? [];
      setAssignments(extractAssignments(categories));
      // Collect all existing category keys from the parsed JSON
      const existingCats = categories.map((c) => ({ key: c.key, label: c.label }));
      const merged = [...DEFAULT_CATEGORIES];
      for (const ec of existingCats) {
        if (!merged.some((m) => m.key === ec.key)) merged.push(ec);
      }
      setCustomCategories(merged);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  // ─── Category assignment handlers ───

  const handleAssignmentChange = (subcategoryKey: string, newCategoryKey: string) => {
    const cat = customCategories.find((c) => c.key === newCategoryKey);
    if (!cat) return;
    setAssignments((prev) =>
      prev.map((a) => (a.subcategoryKey === subcategoryKey ? { ...a, categoryKey: cat.key, categoryLabel: cat.label } : a)),
    );
  };

  const handleAddCategory = () => {
    const key = newCatKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const label = newCatLabel.trim();
    if (!key || !label) return;
    if (customCategories.some((c) => c.key === key)) return;
    setCustomCategories((prev) => [...prev, { key, label }]);
    setNewCatKey('');
    setNewCatLabel('');
  };

  const handleRemoveCategory = (key: string) => {
    // Move any subcategories assigned to this category back to "others"
    setAssignments((prev) =>
      prev.map((a) => (a.categoryKey === key ? { ...a, categoryKey: 'others', categoryLabel: 'Others' } : a)),
    );
    setCustomCategories((prev) => prev.filter((c) => c.key !== key));
  };

  const confirmAssignments = async () => {
    if (!pendingCatalogBundle) return;
    const avatars = pendingCatalogBundle.avatars.map((avatar) => {
      const originalCategories = avatar.catalog?.categories ?? avatar.categories ?? [];
      const rebuiltCategories = rebuildCatalogWithAssignments(originalCategories, assignments, customCategories);
      const defaultSelection = buildDefaultSelection(rebuiltCategories);
      return {
        slug: avatar.slug,
        avatarName: avatar.avatarName,
        catalog: { defaultSelection, categories: rebuiltCategories },
      };
    });
    const bundle: RawCatalogBundle = { avatars };
    setParsed(bundle);
    setPriceRows(flattenToPriceRows(bundle.avatars));
    setPendingCatalogBundle(null);

    // Immediately save catalog to DB (prices default to 0 — admin can update below)
    setSaveStatus({ loading: true });
    try {
      const payload = applyPricesToCatalog(bundle.avatars, flattenToPriceRows(bundle.avatars));
      await callRpc('avatar/sync_avatars', JSON.stringify(payload));
      setSaveStatus({ loading: false, result: 'Catalog saved to database. Set prices below and save again, or upload preview images.' });
      // Populate preview slug for the upload section
      if (bundle.avatars[0]) {
        setPreviewCatalog(bundle.avatars[0].catalog?.categories ?? []);
        setPreviewSlug(bundle.avatars[0].slug);
      }
      loadAvatarList();
    } catch (e) {
      setSaveStatus({ loading: false, error: `Catalog saved locally but DB write failed: ${e instanceof Error ? e.message : 'unknown error'}. Use "Save to database" below to retry.` });
    }
  };

  const setPriceRow = (rowKey: string, field: 'currencyType' | 'price' | 'purchaseLimit', value: string | number) => {
    setPriceRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, [field]: value } : r)));
  };

  const saveToDatabase = async () => {
    if (!parsed || priceRows.length === 0) {
      setSaveStatus({ loading: false, error: 'Upload Spine assets and confirm assignments first.' });
      return;
    }
    setSaveStatus({ loading: true });
    try {
      const payload = applyPricesToCatalog(parsed.avatars, priceRows);
      await callRpc('avatar/sync_avatars', JSON.stringify(payload));
      setSaveStatus({ loading: false, result: 'Prices saved. Catalog and store items updated.' });
      const firstAvatar = payload.avatars[0];
      if (firstAvatar) {
        setPreviewCatalog(firstAvatar.catalog?.categories ?? []);
        setPreviewSlug(firstAvatar.slug);
        setPreviewSubcategory('');
        setPreviewOptionId('');
      }
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
        Upload Spine assets (.json + .txt atlas + .webp) to auto-generate a catalog from skin names (.atlas atlas still supported). Set prices and save to the database. Then upload preview images for each option.
      </p>

      {/* Step guide */}
      <div className="max-w-5xl mb-4 p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-400">
        <span className="font-semibold text-slate-300">Flow: </span>
        <span className="text-indigo-400 font-medium">① Upload Spine Assets</span>
        {' → '}
        <span className="text-indigo-400 font-medium">② Confirm Category Assignments</span>
        <span className="text-slate-500"> (auto-saves catalog to DB)</span>
        {' → '}
        <span className="text-indigo-400 font-medium">③ Adjust Prices &amp; Save</span>
        <span className="text-slate-500"> (optional, can repeat)</span>
        {' → '}
        <span className="text-indigo-400 font-medium">④ Upload Preview Images</span>
        <span className="text-slate-500"> (uploads to fixed R2 path, updates catalog)</span>
      </div>

      <div className="max-w-5xl space-y-4">
        {/* ─── Avatar list ─── */}
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <h2 className="font-medium text-slate-100 mb-2 flex items-center gap-2">
            <List className="w-4 h-4" />
            Avatar list (active = shown in app)
          </h2>
          <p className="text-slate-400 text-xs mb-3">
            Only avatars marked active appear in <code className="bg-slate-700 px-1 rounded">avatar/list_avatars</code>.
          </p>
          {listError && <p className="text-sm text-red-400 mb-2">{listError}</p>}
          {listLoading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <button type="button" onClick={loadAvatarList} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600">
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
                      <tr><td colSpan={3} className="px-3 py-4 text-slate-500 text-center">No avatars in database. Upload Spine assets below.</td></tr>
                    ) : (
                      listAvatars.map((a) => (
                        <tr key={a.avatarId} className="border-t border-slate-600 hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-mono text-xs">{a.slug}</td>
                          <td className="px-3 py-2">{a.avatarName}</td>
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={a.isActive} disabled={togglingId === a.avatarId} onChange={(e) => setAvatarActive(a.avatarId, e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500" />
                              <span className={a.isActive ? 'text-green-400' : 'text-slate-500'}>{togglingId === a.avatarId ? '...' : a.isActive ? 'Yes' : 'No'}</span>
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

        {/* ─── Spine asset upload ─── */}
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <h2 className="font-medium text-slate-100 mb-2 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload Spine Assets
          </h2>
          <p className="text-slate-400 text-xs mb-3">
            Upload the 3 Spine files exported from Spine Animator. The catalog will be auto-generated from the skin names in the .json file. Skins must use <code className="bg-slate-700 px-1 rounded">subcategory/optionId</code> naming (e.g. <code className="bg-slate-700 px-1 rounded">hair/hair_1</code>, <code className="bg-slate-700 px-1 rounded">dress/dress_2</code>).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Avatar slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. avatar1, avatar2" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Spine skeleton (.json)</label>
              <input type="file" accept=".json" onChange={(e) => setSpineJsonFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Spine atlas (.txt preferred, .atlas fallback)</label>
              <input type="file" accept=".txt,.atlas" onChange={(e) => setSpineAtlasFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Texture atlas (.webp or .png)</label>
              <input type="file" accept=".webp,.png" onChange={(e) => setSpineTextureFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600" />
            </div>
          </div>
          <button type="button" onClick={handleSpineUploadAndParse} disabled={uploading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">
            {uploading ? 'Uploading & parsing...' : 'Upload & Parse Spine Assets'}
          </button>
          {uploadStatus.result && <p className="mt-2 text-sm text-green-400">{uploadStatus.result}</p>}
          {uploadStatus.error && <p className="mt-2 text-sm text-red-400">{uploadStatus.error}</p>}
        </div>

        {/* ─── Category assignment step ─── */}
        {assignments.length > 0 && pendingCatalogBundle && (
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <h2 className="font-medium text-slate-100 mb-2">Category Assignments</h2>
            <p className="text-slate-400 text-xs mb-3">
              Each subcategory (from Spine skin names) is auto-assigned to a category. Change the assignment using the dropdown, or create a new category below.
            </p>

            {/* Subcategory → Category assignment table */}
            <div className="overflow-x-auto rounded-lg border border-slate-600 mb-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-700 text-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2">Subcategory</th>
                    <th className="text-left px-3 py-2">Options</th>
                    <th className="text-left px-3 py-2 w-48">Assigned Category</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {assignments.map((a) => {
                    const avatar = pendingCatalogBundle.avatars[0];
                    const origCat = (avatar.catalog?.categories ?? []).find((c) => c.subcategories.some((s) => s.key === a.subcategoryKey));
                    const origSub = origCat?.subcategories.find((s) => s.key === a.subcategoryKey);
                    const optCount = origSub?.options.length ?? 0;
                    return (
                      <tr key={a.subcategoryKey} className="border-t border-slate-600">
                        <td className="px-3 py-2 font-mono text-xs">{a.subcategoryKey}</td>
                        <td className="px-3 py-2 text-slate-400">{optCount} option{optCount !== 1 ? 's' : ''}</td>
                        <td className="px-3 py-2">
                          <select
                            value={a.categoryKey}
                            onChange={(e) => handleAssignmentChange(a.subcategoryKey, e.target.value)}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-xs"
                          >
                            {customCategories.map((c) => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add new category */}
            <div className="flex items-end gap-2 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">New category key</label>
                <input
                  value={newCatKey}
                  onChange={(e) => setNewCatKey(e.target.value)}
                  placeholder="e.g. accessories"
                  className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm w-40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Label</label>
                <input
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="e.g. Accessories"
                  className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm w-40"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={!newCatKey.trim() || !newCatLabel.trim()}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                Add Category
              </button>
            </div>

            {/* Show custom (non-default) categories with remove option */}
            {customCategories.filter((c) => !DEFAULT_CATEGORIES.some((d) => d.key === c.key)).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-1">Custom categories:</p>
                <div className="flex flex-wrap gap-2">
                  {customCategories
                    .filter((c) => !DEFAULT_CATEGORIES.some((d) => d.key === c.key))
                    .map((c) => (
                      <span key={c.key} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-slate-200 text-xs">
                        {c.label} <span className="text-slate-500">({c.key})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(c.key)}
                          className="ml-1 text-slate-400 hover:text-red-400"
                          title="Remove category"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={confirmAssignments}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
            >
              Confirm & Save Catalog to Database
            </button>
          </div>
        )}

        {/* ─── Legacy: catalog JSON paste (collapsible) ─── */}
        <details className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <summary className="font-medium text-slate-100 cursor-pointer flex items-center gap-2 text-sm">
            <Image className="w-4 h-4" />
            Or paste catalog JSON (advanced)
          </summary>
          <div className="mt-3">
            <div className="flex flex-wrap gap-2 mb-2">
              <input ref={fileInputRef} type="file" accept=".json" onChange={onFileChange} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600">
                Upload file
              </button>
              <span className="text-slate-500 text-sm self-center">or paste JSON below</span>
            </div>
            <textarea
              value={catalogRaw}
              onChange={(e) => { setCatalogRaw(e.target.value); setParseError(null); }}
              placeholder='Paste catalog JSON'
              className="w-full h-28 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm font-mono placeholder:text-slate-500"
            />
            <button type="button" onClick={parseCatalog} className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500">
              Parse
            </button>
            {parsed && <span className="ml-3 text-slate-400 text-sm">{parsed.avatars.length} avatar(s), {priceRows.length} option(s)</span>}
            {parseError && <p className="mt-2 text-sm text-red-400">{parseError}</p>}
          </div>
        </details>

        {/* ─── Price table ─── */}
        {priceRows.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <h2 className="font-medium text-slate-100 mb-3">Prices <span className="text-slate-400 text-xs font-normal">(catalog already saved — update prices and save again to override)</span></h2>
            <div className="overflow-x-auto rounded-lg border border-slate-600 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700 text-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5">Avatar</th>
                    <th className="text-left px-2 py-1.5">Category</th>
                    <th className="text-left px-2 py-1.5">Subcategory</th>
                    <th className="text-left px-2 py-1.5">Option</th>
                    <th className="text-left px-2 py-1.5">Label</th>
                    <th className="text-left w-24">Currency</th>
                    <th className="text-left w-24">Price</th>
                    <th className="text-left w-24" title="Max quantity the user can own (1 = buy once)">Limit</th>
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
                        <select value={r.currencyType} onChange={(e) => setPriceRow(r.rowKey, 'currencyType', e.target.value)} className="w-20 px-1 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-100 text-xs">
                          <option value="coins">Coins</option>
                          <option value="gems">Gems</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" min={0} value={r.price === 0 ? '' : r.price} onChange={(e) => setPriceRow(r.rowKey, 'price', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)} placeholder="0" className="w-20 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-100 placeholder:text-slate-500" />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" min={1} value={r.purchaseLimit === 1 ? '' : r.purchaseLimit} onChange={(e) => setPriceRow(r.rowKey, 'purchaseLimit', e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value, 10) || 1))} placeholder="1" title="1 = buy once" className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-100 placeholder:text-slate-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={saveToDatabase} disabled={saveStatus.loading} className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">
              {saveStatus.loading ? 'Saving...' : 'Save to database'}
            </button>
            {saveStatus.result && <p className="mt-2 text-sm text-green-400">{saveStatus.result}</p>}
            {saveStatus.error && <p className="mt-2 text-sm text-red-400">{saveStatus.error}</p>}
          </div>
        )}

        {/* ─── Preview images (step 4 — requires catalog saved first) ─── */}
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <h2 className="font-medium text-slate-100 mb-2 flex items-center gap-2">
            <Image className="w-4 h-4" />
            Upload option preview image
          </h2>
          <p className="text-slate-400 text-xs mb-3">
            Upload a preview image for each option. Each file is saved at the fixed R2 path <code className="bg-slate-700 px-1 rounded">avatars/&#123;slug&#125;/previews/&#123;subcategory&#125;/&#123;optionId&#125;.webp</code> — re-uploading overwrites the existing image at the same URL. The catalog <code className="bg-slate-700 px-1 rounded">previewUrl</code> is updated in the database automatically.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {/* Avatar slug: pick from list or use current */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Avatar</label>
              <select
                value={previewSlug}
                onChange={(e) => { setPreviewSlug(e.target.value); if (e.target.value) loadCatalogForPreview(e.target.value); }}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
              >
                <option value="">Select avatar...</option>
                {listAvatars.map((a) => (
                  <option key={a.slug} value={a.slug}>{a.avatarName} ({a.slug})</option>
                ))}
              </select>
            </div>
            {/* Subcategory dropdown */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Subcategory</label>
              <select
                value={previewSubcategory}
                onChange={(e) => { setPreviewSubcategory(e.target.value); setPreviewOptionId(''); }}
                disabled={previewCatalog.length === 0}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm disabled:opacity-50"
              >
                <option value="">Select subcategory...</option>
                {previewCatalog.flatMap((cat) =>
                  cat.subcategories.map((sub) => (
                    <option key={sub.key} value={sub.key}>{sub.label || sub.key} ({cat.label})</option>
                  ))
                )}
              </select>
            </div>
            {/* Option dropdown */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Option</label>
              <select
                value={previewOptionId}
                onChange={(e) => setPreviewOptionId(e.target.value)}
                disabled={!previewSubcategory}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm disabled:opacity-50"
              >
                <option value="">Select option...</option>
                {previewCatalog.flatMap((cat) =>
                  cat.subcategories
                    .filter((sub) => sub.key === previewSubcategory)
                    .flatMap((sub) => sub.options.map((opt) => (
                      <option key={opt.optionId} value={opt.optionId}>{opt.label} ({opt.optionId})</option>
                    )))
                )}
              </select>
            </div>
            {/* File input */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Image file (any name, will be saved as {previewOptionId || 'optionId'}.webp)</label>
              <input
                ref={previewFileRef}
                type="file"
                accept="image/webp,image/png,image/jpeg,image/gif"
                className="w-full text-sm text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handlePreviewImageUpload}
            disabled={previewUploading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {previewUploading ? 'Uploading…' : 'Upload preview to R2'}
          </button>
          {previewUploadStatus.result && <p className="mt-2 text-sm text-green-400 break-all">{previewUploadStatus.result}</p>}
          {previewUploadStatus.error && <p className="mt-2 text-sm text-red-400">{previewUploadStatus.error}</p>}
        </div>

      </div>
    </div>
  );
}
