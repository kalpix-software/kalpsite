'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, RefreshCw, List, Image } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

// Public base for R2-hosted assets (custom domain in front of the bucket).
const R2_PUBLIC_BASE_URL = 'https://assets.kalpixsoftware.com';

// Local dev: skip re-uploading spine assets to R2. The objects already live on the
// shared R2 bucket from a previous upload, so a fresh local DB only needs to point at
// them — not push them again. Set NEXT_PUBLIC_SKIP_R2_UPLOAD=true in .env to enable.
const SKIP_R2_SPINE_UPLOAD = process.env.NEXT_PUBLIC_SKIP_R2_UPLOAD === 'true';

// ─── Types ───

type AvatarListItem = {
  avatarId: string;
  slug: string;
  avatarName: string;
  previewUrl?: string;
  isActive: boolean;
  randomlyAssignable?: boolean;
  sortOrder?: number;
  /** subcategoryKey -> optionId seeded into a new user's currentSelection. */
  defaultSelection?: Record<string, string>;
};

type CatalogOption = { optionId: string; label: string; previewUrl?: string; skinName?: string; skinDeps?: string; currencyType?: string; price?: number; discountedPrice?: number; purchaseLimit?: number };
type CatalogSubcategory = { key: string; label: string; options: CatalogOption[] };
type CatalogCategory = { key: string; label: string; subcategories: CatalogSubcategory[] };
type CatalogPart = { defaultSelection?: Record<string, string>; categories: CatalogCategory[] };
type AvatarCatalogEntry = { slug: string; avatarName: string; catalog?: CatalogPart; categories?: CatalogCategory[] };
type RawCatalogBundle = { avatars: AvatarCatalogEntry[] };

type PriceRow = { slug: string; categoryKey: string; subcategoryKey: string; optionId: string; label: string; currencyType: string; price: number; salePrice: number; purchaseLimit: number; rowKey: string; itemId?: string };

// ─── Category assignment types ───
type SubcategoryAssignment = { subcategoryKey: string; categoryKey: string; categoryLabel: string };
type CustomCategory = { key: string; label: string };

// ─── Spine JSON parsing (mirrors kalpix-avatars/scripts/create_avatars_catalog logic) ───

type SpineAttachment = { type?: string; path?: string };
type SpineSkin = { name: string; attachments?: Record<string, Record<string, SpineAttachment>> };
type SpineAsset = { skins?: SpineSkin[]; animations?: Record<string, unknown> };

/** A subcategory whose options are rigged into another subcategory's skins (e.g. face → lip). */
type DependentPair = { parentKey: string; childKey: string };

/** What the Spine skin names declared, surfaced in the UI before anything is written. */
type SpineStructure = {
  subcategoryCounts: Record<string, number>;
  dependentPairs: DependentPair[];
  warnings: string[];
};

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

/** What a libGDX/Spine atlas declares: its texture pages, in order, and its region names.
 *
 *  An atlas may pack into several sheets. Each page block starts with the image file name on
 *  its own line — the first line of the file, or the line after a blank separator — followed by
 *  indented or bare `key: value` properties, then the regions packed into it. The Spine runtime
 *  resolves page names relative to the atlas URL, so every page has to be uploaded next to the
 *  atlas under this exact name.
 */
function parseAtlas(atlasText: string): { pages: string[]; regions: Set<string> } {
  const pages: string[] = [];
  const regions = new Set<string>();
  let afterBlank = true;
  for (const raw of atlasText.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') { afterBlank = true; continue; }
    if (!line.includes(':')) {
      // Region names sit at column 0 in the compact export format too, so only a blank
      // line (or the start of the file) plus an image extension marks a page header.
      if (afterBlank && /\.(png|webp|jpg|jpeg)$/i.test(line)) pages.push(line);
      else regions.add(line);
    }
    afterBlank = false;
  }
  return { pages, regions };
}

/** Attachments whose artwork must exist in the atlas, as `{ imageName -> skin that uses it }`.
 *
 *  An attachment refers to its artwork by name (its `path`, defaulting to the attachment name).
 *  Only image-backed types matter — bounding boxes, paths, points and clipping masks carry no art.
 */
function skeletonImageRefs(spineJson: SpineAsset): Map<string, string> {
  const refs = new Map<string, string>();
  for (const skin of spineJson.skins ?? []) {
    for (const attachments of Object.values(skin.attachments ?? {})) {
      for (const [attachmentName, attachment] of Object.entries(attachments ?? {})) {
        const type = attachment?.type ?? 'region';
        if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
        const image = attachment?.path || attachmentName;
        if (!refs.has(image)) refs.set(image, skin.name);
      }
    }
  }
  return refs;
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

/** Subcategory key implied by a leaf option id: "lip_3" -> "lip". */
function leafSubcategoryKey(optionId: string): string {
  const m = optionId.match(/^(.*?)_\d+$/);
  return (m ? m[1] : optionId).trim();
}

/** Parse Spine JSON and build catalog categories (same logic as the Go create_avatars_catalog script).
 *
 *  Two skin-name shapes are supported:
 *    2 parts  "hair/hair_1"        independent  ->  hair: [hair_1]
 *    3 parts  "face/face_1/lip_3"  dependent    ->  face: [face_1] + lip: [lip_3]
 *
 *  The 3-part form is for art that is rigged together and cannot be applied separately
 *  (each face carries its own lip art). The catalog still lists the two halves as ordinary
 *  independent subcategories, so each gets its own previews and store items; the app
 *  recombines the selection back into the single real skin name when it renders.
 */
function buildCatalogFromSpine(
  spineJson: SpineAsset,
  slug: string,
): { categories: CatalogCategory[]; structure: SpineStructure } {
  const subcategoryOptions: Record<string, string[]> = {};
  const dependentPairs: DependentPair[] = [];
  const warnings: string[] = [];
  const pairSeen = new Set<string>();
  const dependentSkinNames = new Set<string>();

  const addOption = (key: string, optionId: string) => {
    if (!subcategoryOptions[key]) subcategoryOptions[key] = [];
    if (!subcategoryOptions[key].includes(optionId)) subcategoryOptions[key].push(optionId);
  };

  for (const skin of spineJson.skins ?? []) {
    const name = skin.name?.trim();
    if (!name || name.toLowerCase() === 'default' || !name.includes('/')) continue;
    const parts = name.split('/').map((s) => s.trim());
    if (parts.some((p) => !p)) continue;

    if (parts.length === 2) {
      addOption(parts[0], parts[1]);
      continue;
    }

    if (parts.length === 3) {
      const [parentKey, parentOption, childOption] = parts;
      const childKey = leafSubcategoryKey(childOption);
      if (!childKey || childKey === parentKey) {
        warnings.push(`Skin "${name}": leaf "${childOption}" does not name a subcategory distinct from "${parentKey}" — skipped.`);
        continue;
      }
      // "face/face_1/face_1_lip_3" gives every parent its own child subcategory
      // (face_1_lip, face_2_lip, …) instead of one shared set. The leaf must not repeat
      // the parent option, or faces cannot share a single set of lip previews and items.
      if (childKey.startsWith(`${parentOption}_`)) {
        const suggested = childKey.slice(parentOption.length + 1);
        const warnId = `repeat:${parentKey}/${parentOption}`;
        if (!pairSeen.has(warnId)) {
          pairSeen.add(warnId);
          warnings.push(
            `Skins under "${parentKey}/${parentOption}/" repeat the parent option in the leaf (e.g. "${childOption}"), ` +
            `so they become a "${childKey}" subcategory of their own instead of joining a shared "${suggested}". ` +
            `Rename the leaves to "${suggested}_1…N" in Spine.`,
          );
        }
      }
      addOption(parentKey, parentOption);
      addOption(childKey, childOption);
      dependentSkinNames.add(name);
      const pairId = `${parentKey}>${childKey}`;
      if (!pairSeen.has(pairId)) {
        pairSeen.add(pairId);
        dependentPairs.push({ parentKey, childKey });
      }
      continue;
    }

    warnings.push(`Skin "${name}" has ${parts.length} levels. Only 2 ("hair/hair_1") and 3 ("face/face_1/lip_3") are supported — skipped.`);
  }

  // A dependent pair is a grid: every parent option needs a skin for every child option.
  // Anything missing is a pick the user can make that renders nothing, so name it here
  // rather than letting it show up as an invisible face in the app.
  for (const pair of dependentPairs) {
    const parents = subcategoryOptions[pair.parentKey] ?? [];
    const children = subcategoryOptions[pair.childKey] ?? [];
    const missing: string[] = [];
    for (const p of parents) {
      for (const c of children) {
        if (!dependentSkinNames.has(`${pair.parentKey}/${p}/${c}`)) missing.push(`${pair.parentKey}/${p}/${c}`);
      }
    }
    if (missing.length > 0) {
      warnings.push(
        `${pair.parentKey} × ${pair.childKey}: ${missing.length} of ${parents.length * children.length} combinations have no skin ` +
        `(e.g. ${missing.slice(0, 3).join(', ')}). Those selections will render nothing.`,
      );
    }
  }

  // Extract animations
  if (spineJson.animations) {
    const animOpts = Object.keys(spineJson.animations)
      .filter((k) => k.trim().toLowerCase() !== 'default')
      .sort();
    if (animOpts.length > 0) subcategoryOptions['animation'] = animOpts;
  }

  // Option ids end up in the store item slug ({avatarId}_{subcategoryKey}_{optionId}) and in the
  // preview object key (avatars/{slug}/previews/{sub}/{optionId}.webp). The R2 key keeps only
  // [A-Za-z0-9-_.], so an id with a space or "+" is uploaded under a different name than the
  // catalog points at, and the preview silently never resolves.
  for (const [key, opts] of Object.entries(subcategoryOptions)) {
    const unsafe = opts.filter((o) => o.replace(/[^a-zA-Z0-9\-_.]/g, '') !== o);
    if (unsafe.length > 0) {
      warnings.push(
        `${key}: ${unsafe.map((o) => `"${o}"`).join(', ')} contain characters that cannot be used in a preview file name or store item slug. ` +
        `Rename them in Spine to letters, digits, dash, underscore or dot.`,
      );
    }
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

  // Half of a dependent pair names no skin on its own — the real skin is "face/face_1/lip_3",
  // which exists only once both halves are picked. Each half therefore carries a *fragment* of
  // that name plus skinDeps, saying which other subcategory completes it and on which side:
  //
  //   face_1 -> skinName "face/face_1", skinDeps "/lip"   leading "/" = partner goes after me
  //   lip_3  -> skinName "lip_3",       skinDeps "face"   no leading "/" = partner goes before me
  //
  // Joining either one with the partner's fragment yields the same "face/face_1/lip_3". The
  // parent fragment keeps the group prefix so the join produces all three parts.
  const dependencyOf = new Map<string, string>();
  for (const pair of dependentPairs) {
    dependencyOf.set(pair.parentKey, `/${pair.childKey}`);
    dependencyOf.set(pair.childKey, pair.parentKey);
  }
  const childKeys = new Set(dependentPairs.map((p) => p.childKey));

  function buildSubcategories(order: string[], all: Record<string, string[]>, isAnimation: boolean): CatalogSubcategory[] {
    const seen = new Set<string>();
    const result: CatalogSubcategory[] = [];
    const buildOne = (k: string, opts: string[]): CatalogSubcategory => ({
      key: k,
      label: k,
      options: opts.map((oid) => ({
        optionId: oid,
        label: humanize(oid),
        // The child half drops the group prefix; the parent half keeps it so the joined
        // name has all three parts. Animations name no skin at all.
        ...(!isAnimation ? { skinName: childKeys.has(k) ? oid : `${k}/${oid}` } : {}),
        ...(dependencyOf.has(k) ? { skinDeps: dependencyOf.get(k) } : {}),
        // Same path pattern as cosmetic previews so R2 uploads (subcategory/optionId.webp) match after sync.
        previewUrl: `avatars/${slug}/previews/${k}/${oid}.webp`,
      })),
    });
    for (const k of order) {
      if (!all[k] || seen.has(k)) continue;
      seen.add(k);
      result.push(buildOne(k, all[k]));
    }
    // Remaining keys not in order
    for (const [k, opts] of Object.entries(all)) {
      if (seen.has(k)) continue;
      result.push(buildOne(k, opts));
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

  const subcategoryCounts: Record<string, number> = {};
  for (const [k, opts] of Object.entries(subcategoryOptions)) subcategoryCounts[k] = opts.length;

  return { categories, structure: { subcategoryCounts, dependentPairs, warnings } };
}

// ─── Catalog shape guard ───
//
// Store item identity is `{avatarID}_{subcategoryKey}_{optionId}` (backend
// services/store/sync_avatar_items.go), and ownership rows point at that slug. So renaming a
// subcategory or dropping an option orphans everything users already bought under the old key.
// Before the first write we diff the incoming shape against what the DB already holds and make
// the admin acknowledge anything destructive.

type CatalogShape = Record<string, { categoryKey: string; optionIds: string[] }>;

function shapeOf(categories: CatalogCategory[]): CatalogShape {
  const shape: CatalogShape = {};
  for (const cat of categories) {
    for (const sub of cat.subcategories ?? []) {
      const ids = (sub.options ?? []).map((o) => o.optionId);
      const prev = shape[sub.key];
      shape[sub.key] = {
        categoryKey: prev?.categoryKey ?? cat.key,
        optionIds: [...(prev?.optionIds ?? []), ...ids].sort(),
      };
    }
  }
  return shape;
}

type ShapeDiff = {
  addedSubcategories: string[];
  removedSubcategories: string[];
  addedOptions: string[];
  removedOptions: string[];
  /** Absent from the upload but kept by the backend, so not a removal. */
  preservedSubcategories: string[];
};

function diffShapes(prev: CatalogShape, next: CatalogShape): ShapeDiff {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);

  // Mirrors mergeMissingCategories in the backend (services/avatar/avatar.go): a whole
  // top-level category the incoming catalog cannot produce — "background", managed on the
  // backgrounds admin page rather than by Spine — is carried forward untouched by the sync.
  // Reporting those as removals would be a false alarm, and a guard that cries wolf gets
  // clicked through.
  const incomingCategoryKeys = new Set(Object.values(next).map((v) => v.categoryKey));
  const preservedSubcategories = prevKeys.filter(
    (k) => !next[k] && !incomingCategoryKeys.has(prev[k].categoryKey),
  );
  const preserved = new Set(preservedSubcategories);

  const addedOptions: string[] = [];
  const removedOptions: string[] = [];
  for (const k of nextKeys) {
    if (!prev[k]) continue; // whole subcategory is new; reported separately
    for (const id of next[k].optionIds) if (!prev[k].optionIds.includes(id)) addedOptions.push(`${k}/${id}`);
  }
  for (const k of prevKeys) {
    if (!next[k]) continue; // whole subcategory is gone or preserved; reported separately
    for (const id of prev[k].optionIds) if (!next[k].optionIds.includes(id)) removedOptions.push(`${k}/${id}`);
  }
  return {
    addedSubcategories: nextKeys.filter((k) => !prev[k]),
    removedSubcategories: prevKeys.filter((k) => !next[k] && !preserved.has(k)),
    addedOptions,
    removedOptions,
    preservedSubcategories,
  };
}

/** Only removals orphan existing store items; additions are always safe. */
function isBreakingDiff(d: ShapeDiff | null): boolean {
  return !!d && (d.removedSubcategories.length > 0 || d.removedOptions.length > 0);
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
            salePrice: opt.discountedPrice ?? 0,
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
              const salePrice = row ? row.salePrice : (opt.discountedPrice ?? 0);
              return {
                ...opt,
                currencyType: row ? row.currencyType : (opt.currencyType ?? 'coins'),
                price: row ? row.price : (opt.price ?? 0),
                discountedPrice: salePrice > 0 ? salePrice : undefined,
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

// ─── R2 upload helper (browser-direct via presigned URL from backend) ───

/** Content-type mapping for file extensions */
function contentTypeForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.txt') || name.endsWith('.atlas')) return 'text/plain';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif')) return 'image/gif';
  return file.type || 'application/octet-stream';
}

/**
 * Upload a file directly to R2 from the browser:
 * 1. Get a presigned PUT URL from backend (store/admin_get_upload_url RPC)
 * 2. Browser PUTs the file directly to R2 (no server proxy)
 * Returns the public URL of the uploaded file.
 */
async function uploadFileToR2(file: File, itemType: string, category: string, fileName?: string, subcategory?: string): Promise<string> {
  const contentType = contentTypeForFile(file);

  // Local dev bypass: spine assets already exist on the shared R2 bucket. Skip the presign
  // RPC and the browser PUT entirely so a fresh local DB needs no R2 access, and just return
  // the deterministic public URL (backend key pattern: avatars/{slug}/spine/{fileName}).
  if (SKIP_R2_SPINE_UPLOAD && itemType === 'avatar_spine') {
    return `${R2_PUBLIC_BASE_URL}/avatars/${category}/spine/${fileName ?? file.name}`;
  }

  // Step 1: Get presigned URL from backend
  const rpcPayload = JSON.stringify({
    itemType,
    category,
    subcategory: subcategory ?? '',
    contentType,
    fileName: fileName ?? file.name,
  });
  const rpcResult = await callAdminRpc('store/admin_get_upload_url', rpcPayload);
  const data = unwrapAdminRpcData<{ uploadUrl?: string; publicUrl?: string }>(rpcResult);
  if (!data?.uploadUrl || !data?.publicUrl) {
    throw new Error('Failed to get upload URL from backend');
  }

  // Step 2: Browser PUTs file directly to R2 using presigned URL
  const putRes = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => '');
    throw new Error(`R2 upload failed (${putRes.status}): ${errText.slice(0, 200)}`);
  }

  return data.publicUrl;
}

// ─── Page Component ───

export default function AdminAvatarsPage() {
  // Spine file upload state
  const [slug, setSlug] = useState('');
  const [spineJsonFile, setSpineJsonFile] = useState<File | null>(null);
  const [spineAtlasFile, setSpineAtlasFile] = useState<File | null>(null);
  // One entry per atlas page — an atlas may pack into several sheets.
  const [spineTextureFiles, setSpineTextureFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ result?: string; error?: string }>({});

  const [previewSubcategory, setPreviewSubcategory] = useState('');
  const [previewOptionId, setPreviewOptionId] = useState('');
  const [previewSlug, setPreviewSlug] = useState('');
  const [previewUploading, setPreviewUploading] = useState(false);
  const [previewUploadStatus, setPreviewUploadStatus] = useState<{ result?: string; error?: string }>({});
  const previewFileRef = useRef<HTMLInputElement>(null);
  const [previewCatalog, setPreviewCatalog] = useState<CatalogCategory[]>([]);
  // Track which preview images already exist on R2: key = "subcategoryKey/optionId", value = true (exists) / false (missing) / undefined (checking)
  const [previewExists, setPreviewExists] = useState<Record<string, boolean>>({});
  const [previewCheckLoading, setPreviewCheckLoading] = useState(false);
  /** When true, upload is skipped if we already detected a preview on R2 for the selected option */
  const [skipUploadIfPreviewExists, setSkipUploadIfPreviewExists] = useState(false);

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

  // Per-avatar default selection (what a new user starts with).
  const [defaultsSlug, setDefaultsSlug] = useState('');
  const [defaultsCatalog, setDefaultsCatalog] = useState<CatalogCategory[]>([]);
  const [defaultsSel, setDefaultsSel] = useState<Record<string, string>>({});
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [savingDefaultKey, setSavingDefaultKey] = useState('');
  const [defaultsStatus, setDefaultsStatus] = useState<{ result?: string; error?: string }>({});

  // What the Spine skin names declared, plus how it differs from the catalog already in the DB.
  const [spineStructure, setSpineStructure] = useState<SpineStructure | null>(null);
  const [shapeDiff, setShapeDiff] = useState<ShapeDiff | null>(null);
  const [shapeAck, setShapeAck] = useState(false);

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
    const existKey = `${sub}/${optionId}`;
    if (skipUploadIfPreviewExists && previewExists[existKey] === true) {
      setPreviewUploadStatus({ result: 'Skipped — preview already on R2 (disable “Skip if preview exists” to overwrite).' });
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
      setPreviewExists((prev) => ({ ...prev, [existKey]: true }));
      if (previewFileRef.current) previewFileRef.current.value = '';
    } catch (e) {
      setPreviewUploadStatus({ error: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setPreviewUploading(false);
    }
  };

  const R2_PUBLIC_BASE = R2_PUBLIC_BASE_URL;

  async function headOk(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'cors' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** True if a preview object exists: catalog previewUrl (if http) or any of .webp/.png/.jpg/.jpeg/.gif at the canonical path */
  async function previewObjectExists(avatarSlug: string, subcategoryKey: string, opt: CatalogOption): Promise<boolean> {
    const pu = opt.previewUrl?.trim();
    if (pu?.startsWith('http') && (await headOk(pu))) return true;
    const base = `${R2_PUBLIC_BASE}/avatars/${avatarSlug}/previews/${subcategoryKey}/${opt.optionId}`;
    for (const ext of ['.webp', '.png', '.jpg', '.jpeg', '.gif']) {
      if (await headOk(base + ext)) return true;
    }
    return false;
  }

  // Check which preview images exist on R2 for the given subcategory
  const checkPreviewsExist = useCallback(async (avatarSlug: string, subcategoryKey: string, catalog: CatalogCategory[]) => {
    const options: CatalogOption[] = [];
    for (const cat of catalog) {
      for (const sub of cat.subcategories) {
        if (sub.key === subcategoryKey) {
          options.push(...sub.options);
        }
      }
    }
    setPreviewCheckLoading(true);
    // Mark all as "checking" (undefined) until done — clear previous keys for this subcategory
    setPreviewExists((prev) => {
      const next = { ...prev };
      for (const opt of options) delete next[`${subcategoryKey}/${opt.optionId}`];
      return next;
    });
    try {
      const checks = options.map(async (opt) => {
        const key = `${subcategoryKey}/${opt.optionId}`;
        const exists = await previewObjectExists(avatarSlug, subcategoryKey, opt);
        return { key, exists };
      });
      const results = await Promise.all(checks);
      setPreviewExists((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.key] = r.exists;
        return next;
      });
    } finally {
      setPreviewCheckLoading(false);
    }
  }, []);

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
      setPreviewExists({});
    } catch {
      setPreviewUploadStatus({ error: `Failed to load catalog for ${avatarSlug}` });
    }
  };

  // ─── Default selection (what a brand-new user starts this avatar with) ───

  const loadDefaultsForAvatar = async (slug: string) => {
    setDefaultsSlug(slug);
    setDefaultsStatus({});
    setDefaultsSel(listAvatars.find((a) => a.slug === slug)?.defaultSelection ?? {});
    if (!slug) { setDefaultsCatalog([]); return; }
    setDefaultsLoading(true);
    try {
      const raw = await callRpc('avatar/get_character_catalog', JSON.stringify({ slug }));
      setDefaultsCatalog(unwrapAdminRpcData<{ categories?: CatalogCategory[] }>(raw)?.categories ?? []);
    } catch {
      setDefaultsCatalog([]);
      setDefaultsStatus({ error: `Failed to load catalog for ${slug}` });
    } finally {
      setDefaultsLoading(false);
    }
  };

  /** Seeds new users' currentSelection for this subcategory. Stored in avatar_catalogs.default_selection. */
  const setDefaultOption = async (subcategoryKey: string, optionId: string) => {
    if (!defaultsSlug || !optionId) return;
    setSavingDefaultKey(subcategoryKey);
    setDefaultsStatus({});
    try {
      await callRpc('avatar/admin_set_default_option', JSON.stringify({ slug: defaultsSlug, subcategoryKey, optionId }));
      setDefaultsSel((prev) => ({ ...prev, [subcategoryKey]: optionId }));
      setListAvatars((prev) => prev.map((a) => (a.slug === defaultsSlug
        ? { ...a, defaultSelection: { ...(a.defaultSelection ?? {}), [subcategoryKey]: optionId } }
        : a)));
      setDefaultsStatus({ result: `Default ${subcategoryKey} set to ${optionId}.` });
    } catch (e) {
      setDefaultsStatus({ error: e instanceof Error ? e.message : 'Failed to set default' });
    } finally {
      setSavingDefaultKey('');
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

  // Toggle whether this avatar is eligible for new-user random assignment (independent of Active).
  const setAvatarAssignable = async (avatarId: string, randomlyAssignable: boolean) => {
    setTogglingId(avatarId);
    try {
      await callRpc('avatar/admin_set_avatar_assignable', JSON.stringify({ avatarId, randomlyAssignable }));
      setListAvatars((prev) => prev.map((a) => (a.avatarId === avatarId ? { ...a, randomlyAssignable } : a)));
    } catch {
      setListError('Failed to update random-pool state');
    } finally {
      setTogglingId(null);
    }
  };

  // ─── Spine file upload + auto-parse ───

  const handleSpineUploadAndParse = async () => {
    if (!slug.trim()) { setUploadStatus({ error: 'Enter an avatar slug (e.g. avatar1)' }); return; }
    if (!spineJsonFile) { setUploadStatus({ error: 'Select the Spine .json file' }); return; }
    if (!spineAtlasFile) { setUploadStatus({ error: 'Select the Spine atlas file (.txt or .atlas)' }); return; }
    if (spineTextureFiles.length === 0) { setUploadStatus({ error: 'Select the Spine texture image(s) (.webp or .png) — one per atlas page' }); return; }

    setUploading(true);
    setUploadStatus({});
    setParseError(null);
    setSpineStructure(null);
    setShapeDiff(null);
    setShapeAck(false);
    try {
      const s = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // 1. Read and parse the Spine JSON to extract skins/animations
      const jsonText = await spineJsonFile.text();
      const spineData = JSON.parse(jsonText) as SpineAsset;
      const atlasText = await spineAtlasFile.text();

      // The skeleton and the atlas refer to artwork by name. If the skeleton asks for a name the
      // atlas does not define, the Spine runtime throws while loading and the WHOLE avatar fails —
      // not just that piece. Catch it here: an avatar that cannot load must never reach R2.
      const { pages, regions } = parseAtlas(atlasText);
      const dangling = [...skeletonImageRefs(spineData)].filter(([image]) => !regions.has(image));
      if (dangling.length > 0) {
        const shown = dangling.slice(0, 8).map(([image, skin]) => `"${image}" (used by ${skin})`);
        setUploadStatus({
          error: `${spineJsonFile.name} references ${dangling.length} image${dangling.length !== 1 ? 's' : ''} that ${spineAtlasFile.name} does not contain: ${shown.join(', ')}` +
            `${dangling.length > 8 ? `, and ${dangling.length - 8} more` : ''}. ` +
            `The avatar would fail to load with "Error reading attachment". Ask the animator to relink these attachments in Spine, then re-export all three files together.`,
        });
        setUploading(false);
        return;
      }

      const { categories, structure } = buildCatalogFromSpine(spineData, s);
      if (categories.length === 0) {
        setUploadStatus({ error: 'No skins found in the Spine JSON. Skins must use "subcategory/optionId" naming (e.g. "hair/hair_1"), or "subcategory/optionId/dependentOptionId" for rigged-together art (e.g. "face/face_1/lip_3").' });
        setUploading(false);
        return;
      }
      setSpineStructure(structure);

      // Diff against the catalog already stored for this slug, so a naming change that would
      // orphan existing store items has to be acknowledged before anything is written.
      try {
        const raw = await callRpc('avatar/get_character_catalog', JSON.stringify({ slug: s }));
        const existing = unwrapAdminRpcData<{ categories?: CatalogCategory[] }>(raw)?.categories ?? [];
        if (existing.length > 0) setShapeDiff(diffShapes(shapeOf(existing), shapeOf(categories)));
      } catch {
        // No catalog yet for this slug (first upload) — nothing to compare against.
      }

      // 2. Upload the Spine files to avatars/{slug}/spine/.
      //
      // The skeleton and atlas get deterministic {slug} names because the backend builds their
      // URLs from the slug alone. Texture pages must NOT be renamed: the runtime reads the page
      // names out of the atlas text and fetches each one relative to the atlas URL, so the object
      // key has to match the name the atlas declares — and there may be several.
      if (pages.length === 0) {
        setUploadStatus({ error: `No texture pages declared in ${spineAtlasFile.name}. The atlas should name each sheet on its own line (e.g. "${s}.webp").` });
        setUploading(false);
        return;
      }
      // The R2 key keeps only [A-Za-z0-9-_.]; anything else would be stored under a name the
      // atlas does not reference, which fails at load with no upload error to point at.
      const unsafe = pages.filter((p) => p.replace(/[^a-zA-Z0-9\-_.]/g, '') !== p);
      if (unsafe.length > 0) {
        setUploadStatus({ error: `These texture page names cannot be stored as-is: ${unsafe.join(', ')}. Rename the images (letters, digits, dash, underscore, dot only) and re-export the atlas so it references the new names.` });
        setUploading(false);
        return;
      }

      const selectedByName = new Map(spineTextureFiles.map((f) => [f.name, f]));
      const missing = pages.filter((p) => !selectedByName.has(p));
      const extra = spineTextureFiles.map((f) => f.name).filter((n) => !pages.includes(n));
      if (missing.length > 0 || extra.length > 0) {
        setUploadStatus({
          error: [
            `Texture selection does not match the ${pages.length} page${pages.length !== 1 ? 's' : ''} declared in the atlas.`,
            missing.length > 0 ? `Missing: ${missing.join(', ')}.` : '',
            extra.length > 0 ? `Not referenced by the atlas: ${extra.join(', ')}.` : '',
            'Pick exactly the files the atlas names — they are uploaded under those names.',
          ].filter(Boolean).join(' '),
        });
        setUploading(false);
        return;
      }

      const atlasKey = spineAtlasObjectKey(s, spineAtlasFile);
      await Promise.all([
        uploadFileToR2(spineJsonFile, 'avatar_spine', s, `${s}.json`),
        uploadFileToR2(spineAtlasFile, 'avatar_spine', s, atlasKey),
        ...pages.map((p) => uploadFileToR2(selectedByName.get(p)!, 'avatar_spine', s, p)),
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
      const uploadVerb = SKIP_R2_SPINE_UPLOAD ? 'reused from R2 (upload skipped — local mode)' : 'uploaded to R2';
      const pageNote = `${pages.length} texture page${pages.length !== 1 ? 's' : ''} (${pages.join(', ')})`;
      setUploadStatus({ result: `Spine assets ${uploadVerb}: skeleton, atlas, ${pageNote}. ${categories.reduce((n, c) => n + c.subcategories.reduce((m, sub) => m + sub.options.length, 0), 0)} options found. Review category assignments below, then confirm to set prices.` });
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

  /** Fetch store items from DB for each avatar and merge itemId + prices into price rows.
   *
   *  We need the avatarID (UUID) to know the store item slug pattern:
   *    {avatarID}_{subcategoryKey}_{optionId}
   *  The avatar list gives us avatarId for each slug.
   */
  const mergeDbPricesIntoRows = async (rows: PriceRow[], avatarSlugs: string[]): Promise<PriceRow[]> => {
    // Step 1: Resolve avatar slug → avatarId (UUID) from the avatar list
    const slugToAvatarId = new Map<string, string>();
    for (const av of listAvatars) {
      slugToAvatarId.set(av.slug, av.avatarId);
    }
    // If avatars not in list yet, fetch them
    if (avatarSlugs.some((s) => !slugToAvatarId.has(s))) {
      try {
        const data = await callRpc('avatar/admin_list_avatars', '{}') as { data?: { avatars?: AvatarListItem[] }; avatars?: AvatarListItem[] };
        const raw = data?.data ?? data;
        for (const av of raw?.avatars ?? []) {
          slugToAvatarId.set(av.slug, av.avatarId);
        }
      } catch (e) {
        console.warn('Failed to fetch avatar list for ID resolution:', e);
      }
    }

    // Step 2: Fetch store items for each avatar
    type DbEntry = { itemId: string; coins: number; gems: number; discountedCoins: number; discountedGems: number; purchaseLimit: number };
    // Key: "subcategoryKey|optionId"
    const dbMap = new Map<string, DbEntry>();

    for (const avatarSlug of avatarSlugs) {
      const avatarId = slugToAvatarId.get(avatarSlug);
      if (!avatarId) {
        console.warn(`No avatarId found for slug "${avatarSlug}"`);
        continue;
      }
      try {
        // Use avatarId (UUID) as category — the backend resolves this via avatar_id column
        const data = await callRpc('store/get_items', JSON.stringify({
          upgradeType: 'avatar_upgrade',
          category: avatarId,
          includeInactive: true,
          limit: 2000,
        })) as { data?: { items?: Record<string, unknown>[] }; items?: Record<string, unknown>[] };
        const raw = data?.data ?? data;
        const items = raw?.items ?? [];
        for (const item of items) {
          // Use subcategoryKey and optionId fields directly from the backend response
          // (parsing the slug fails for keys with underscores like "eye_color")
          const subKey = (item.subcategoryKey as string) || (item.subcategory as string) || '';
          const optId = (item.optionId as string) || '';
          if (!subKey || !optId) continue;

          const price = item.price as { coins?: number; gems?: number } | undefined;
          const metadata = item.metadata as Record<string, string> | undefined;
          const limit = parseInt(metadata?.purchaseLimit ?? '1', 10);
          const matchKey = `${subKey}|${optId}`;
          dbMap.set(matchKey, {
            itemId: (item.itemId as string) ?? '',
            coins: price?.coins ?? 0,
            gems: price?.gems ?? 0,
            discountedCoins: (item.discountedPriceCoins as number) ?? 0,
            discountedGems: (item.discountedPriceGems as number) ?? 0,
            purchaseLimit: limit > 0 ? limit : 1,
          });
        }
      } catch (e) {
        console.warn(`Failed to fetch store items for avatar ${avatarSlug} (${avatarId}):`, e);
      }
    }

    if (dbMap.size === 0) return rows;

    return rows.map((row) => {
      const matchKey = `${row.subcategoryKey}|${row.optionId}`;
      const db = dbMap.get(matchKey);
      if (!db) return row;
      const price = db.coins > 0 ? db.coins : db.gems;
      const salePrice = db.discountedCoins > 0 ? db.discountedCoins : db.discountedGems;
      return {
        ...row,
        itemId: db.itemId,
        currencyType: db.gems > 0 ? 'gems' : 'coins',
        price,
        salePrice,
        purchaseLimit: db.purchaseLimit,
      };
    });
  };

  const confirmAssignments = async () => {
    if (!pendingCatalogBundle) return;
    // First write to the DB happens below. Removals rename store item slugs, which orphans
    // ownership rows for anything users already bought — never do that silently.
    if (isBreakingDiff(shapeDiff) && !shapeAck) {
      setSaveStatus({ loading: false, error: 'This catalog removes subcategories or options that already exist in the database. Review the change above and tick the acknowledgement before syncing.' });
      return;
    }
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
    const initialRows = flattenToPriceRows(bundle.avatars);
    setPendingCatalogBundle(null);

    setSaveStatus({ loading: true });
    try {
      // Step 1: Sync catalog to DB so that store items are created and
      // itemId + existing prices are written back into the catalog options.
      const payload = applyPricesToCatalog(bundle.avatars, initialRows);
      await callRpc('avatar/sync_avatars', JSON.stringify(payload));

      // Step 2: Fetch the saved catalog back — it now has itemId + prices
      // from the DB (existing items keep their prices, new items get 0).
      const avatarSlugs = avatars.map((a) => a.slug);
      const mergedRows = await mergeDbPricesIntoRows(initialRows, avatarSlugs);
      setPriceRows(mergedRows);

      const existingCount = mergedRows.filter((r) => r.itemId).length;
      const newCount = mergedRows.length - existingCount;
      const msg = existingCount > 0
        ? `Synced. ${existingCount} items loaded with prices from database${newCount > 0 ? `, ${newCount} new items` : ''}. Edit below and save.`
        : `Synced ${newCount} new items. Set prices below, then click "Save to database".`;
      setSaveStatus({ loading: false, result: msg });

      if (bundle.avatars[0]) {
        setPreviewCatalog(bundle.avatars[0].catalog?.categories ?? []);
        setPreviewSlug(bundle.avatars[0].slug);
      }
      loadAvatarList();
    } catch (e) {
      setPriceRows(initialRows);
      setSaveStatus({ loading: false, error: `Sync failed: ${e instanceof Error ? e.message : 'unknown error'}. You can still set prices and retry.` });
    }
  };

  const setPriceRow = (rowKey: string, field: 'currencyType' | 'price' | 'salePrice' | 'purchaseLimit', value: string | number) => {
    setPriceRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, [field]: value } : r)));
  };

  const saveToDatabase = async () => {
    if (!parsed || priceRows.length === 0) {
      setSaveStatus({ loading: false, error: 'Upload Spine assets and confirm assignments first.' });
      return;
    }
    setSaveStatus({ loading: true });
    try {
      // Step 1: Sync catalog structure to DB (creates new items, updates names/skins).
      // Pass current prices so NEW items are created with the admin-set price.
      const payload = applyPricesToCatalog(parsed.avatars, priceRows);
      await callRpc('avatar/sync_avatars', JSON.stringify(payload));

      // Step 2: Fetch itemIds from DB (newly created items from step 1 now have IDs).
      // Only use this to resolve itemIds — keep admin-entered prices from priceRows.
      const avatarSlugs = parsed.avatars.map((a) => a.slug);
      const dbRows = await mergeDbPricesIntoRows(priceRows, avatarSlugs);
      const itemIdByKey = new Map<string, string>();
      for (const r of dbRows) {
        if (r.itemId) itemIdByKey.set(r.rowKey, r.itemId);
      }

      // Step 3: Update prices for ALL items via admin API.
      // Use admin-entered priceRows (not DB values) as the authoritative source.
      const rowsToSave = priceRows.map((r) => ({ ...r, itemId: itemIdByKey.get(r.rowKey) ?? r.itemId }));
      const withIds = rowsToSave.filter((r) => r.itemId);
      console.log(`[saveToDatabase] ${rowsToSave.length} total rows, ${withIds.length} have itemId`);
      if (withIds.length > 0) console.log('[saveToDatabase] sample row:', withIds[0]);
      let updated = 0;
      let failed = 0;
      for (const row of rowsToSave) {
        if (!row.itemId) continue;
        const coins = row.currencyType === 'coins' ? row.price : 0;
        const gems = row.currencyType === 'gems' ? row.price : 0;
        const discountedCoins = row.currencyType === 'coins' ? row.salePrice : 0;
        const discountedGems = row.currencyType === 'gems' ? row.salePrice : 0;
        try {
          await callRpc('store/admin_update_item', JSON.stringify({
            itemId: row.itemId,
            price: { coins, gems },
            discountedPriceCoins: discountedCoins,
            discountedPriceGems: discountedGems,
            metadata: { purchaseLimit: String(row.purchaseLimit) },
          }));
          updated++;
        } catch (e) {
          console.warn(`Failed to update price for ${row.itemId}:`, e);
          failed++;
        }
      }

      // Update local state with itemIds
      setPriceRows(rowsToSave);

      // New avatars are drafts until published, so "saved" on its own reads as
      // "done" when there is still one step left. Say what the remaining step is.
      // Absent from the list counts as draft: a first-time upload has no row
      // in the loaded list yet, and that is precisely the case that needs the
      // reminder. Guarded on the list having loaded at all, so an empty list
      // never labels a live avatar a draft.
      const liveSlugs = new Set(listAvatars.filter((la) => la.isActive).map((la) => la.slug));
      const draftSlugs = listAvatars.length > 0
        ? payload.avatars.map((a) => a.slug).filter((slug) => !liveSlugs.has(slug))
        : [];
      const publishHint = draftSlugs.length > 0
        ? ` ${draftSlugs.join(', ')} ${draftSlugs.length === 1 ? 'is' : 'are'} still Draft — publish in the avatar list above when the previews are done.`
        : '';
      const msg = failed > 0
        ? `Saved ${updated} items, ${failed} failed. Check console for details.${publishHint}`
        : `All ${updated} items saved successfully.${publishHint}`;
      setSaveStatus({ loading: false, result: msg });

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
            Avatar list (Live = shown in app)
          </h2>
          <p className="text-slate-400 text-xs mb-3">
            Only Live avatars appear in <code className="bg-slate-700 px-1 rounded">avatar/list_avatars</code>.
            A newly uploaded avatar starts as <span className="text-amber-400">Draft</span> and stays hidden until you
            publish it here — syncing again (previews, prices) never changes this, so finish the whole upload first.
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
                      <th className="text-left px-3 py-2 w-32" title="Live avatars are visible to players. Draft avatars are hidden until you publish them.">Status</th>
                      <th className="text-left px-3 py-2 w-32" title="Eligible for new-user random assignment (independent of Active)">Random pool</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {listAvatars.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-4 text-slate-500 text-center">No avatars in database. Upload Spine assets below.</td></tr>
                    ) : (
                      listAvatars.map((a) => (
                        <tr key={a.avatarId} className="border-t border-slate-600 hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-mono text-xs">{a.slug}</td>
                          <td className="px-3 py-2">{a.avatarName}</td>
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={a.isActive} disabled={togglingId === a.avatarId} onChange={(e) => setAvatarActive(a.avatarId, e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500" />
                              <span className={a.isActive ? 'text-green-400' : 'text-amber-400'}>{togglingId === a.avatarId ? '...' : a.isActive ? 'Live' : 'Draft'}</span>
                            </label>
                          </td>
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={a.randomlyAssignable ?? true} disabled={togglingId === a.avatarId} onChange={(e) => setAvatarAssignable(a.avatarId, e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500" />
                              <span className={(a.randomlyAssignable ?? true) ? 'text-green-400' : 'text-slate-500'}>{togglingId === a.avatarId ? '...' : (a.randomlyAssignable ?? true) ? 'Yes' : 'No'}</span>
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
              <label className="block text-xs text-slate-400 mb-1">Texture pages (.webp or .png) — select all</label>
              <input type="file" accept=".webp,.png" multiple onChange={(e) => setSpineTextureFiles(Array.from(e.target.files ?? []))} className="w-full text-sm text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600" />
              <p className="mt-1 text-[11px] text-slate-500">
                An atlas can pack into several sheets. Select every page the atlas names — they are uploaded under those exact names, so the runtime can resolve them.
              </p>
              {spineTextureFiles.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-400 font-mono">{spineTextureFiles.length} selected: {spineTextureFiles.map((f) => f.name).join(', ')}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={handleSpineUploadAndParse} disabled={uploading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50">
            {uploading ? 'Uploading & parsing...' : 'Upload & Parse Spine Assets'}
          </button>
          {uploadStatus.result && <p className="mt-2 text-sm text-green-400">{uploadStatus.result}</p>}
          {uploadStatus.error && <p className="mt-2 text-sm text-red-400">{uploadStatus.error}</p>}
        </div>

        {/* ─── Derived structure: what the skin names declared, before anything is written ─── */}
        {spineStructure && (
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <h2 className="font-medium text-slate-100 mb-2">Structure read from Spine</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(spineStructure.subcategoryCounts).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => (
                <span key={key} className="px-2 py-1 rounded bg-slate-900 border border-slate-600 font-mono text-xs text-slate-200">
                  {key} <span className="text-slate-400">({count})</span>
                </span>
              ))}
            </div>

            {spineStructure.dependentPairs.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-slate-900 border border-slate-600">
                <p className="text-xs text-slate-300 mb-1">Dependent pairs (3-level skin names):</p>
                {spineStructure.dependentPairs.map((p) => (
                  <p key={`${p.parentKey}>${p.childKey}`} className="font-mono text-xs text-indigo-300">
                    {p.parentKey} + {p.childKey} → {p.parentKey}/&#123;{p.parentKey}&#125;/&#123;{p.childKey}&#125;
                  </p>
                ))}
                <p className="text-xs text-slate-400 mt-1">
                  Picked separately in the app; recombined into the single real skin at render time.
                </p>
              </div>
            )}

            {spineStructure.warnings.length > 0 && (
              <ul className="mb-1 space-y-1">
                {spineStructure.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-400">⚠ {w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ─── Shape diff vs the catalog already in the DB ─── */}
        {shapeDiff && (shapeDiff.addedSubcategories.length > 0 || shapeDiff.removedSubcategories.length > 0 || shapeDiff.addedOptions.length > 0 || shapeDiff.removedOptions.length > 0 || shapeDiff.preservedSubcategories.length > 0) && (
          <div className={`p-4 rounded-xl border ${isBreakingDiff(shapeDiff) ? 'bg-red-950/40 border-red-700' : 'bg-slate-800 border-slate-700'}`}>
            <h2 className="font-medium text-slate-100 mb-2">Change vs the saved catalog</h2>
            <div className="space-y-1 text-xs font-mono">
              {shapeDiff.addedSubcategories.map((k) => <p key={`+s${k}`} className="text-green-400">+ subcategory {k}</p>)}
              {shapeDiff.removedSubcategories.map((k) => <p key={`-s${k}`} className="text-red-400">− subcategory {k}</p>)}
              {shapeDiff.addedOptions.slice(0, 20).map((k) => <p key={`+o${k}`} className="text-green-400">+ {k}</p>)}
              {shapeDiff.addedOptions.length > 20 && <p className="text-slate-400">…and {shapeDiff.addedOptions.length - 20} more additions</p>}
              {shapeDiff.removedOptions.slice(0, 20).map((k) => <p key={`-o${k}`} className="text-red-400">− {k}</p>)}
              {shapeDiff.removedOptions.length > 20 && <p className="text-slate-400">…and {shapeDiff.removedOptions.length - 20} more removals</p>}
              {shapeDiff.preservedSubcategories.map((k) => (
                <p key={`=${k}`} className="text-slate-400">= subcategory {k} — not in this upload, kept as-is by the sync</p>
              ))}
            </div>
            {isBreakingDiff(shapeDiff) && (
              <>
                <p className="mt-3 text-xs text-red-300">
                  Store items are keyed <span className="font-mono">{'{avatarId}_{subcategoryKey}_{optionId}'}</span>. Removing a subcategory or option
                  orphans the store items under the old key, so anything users already purchased there will show as unowned. Re-check the Spine skin
                  names before continuing.
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-200">
                  <input type="checkbox" checked={shapeAck} onChange={(e) => setShapeAck(e.target.checked)} className="accent-red-500" />
                  I understand this orphans existing store items and want to sync anyway.
                </label>
              </>
            )}
          </div>
        )}

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
                    <th className="text-left w-24" title="Discounted price (0 = no sale)">Sale Price</th>
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
                        <input type="number" min={0} value={r.salePrice === 0 ? '' : r.salePrice} onChange={(e) => setPriceRow(r.rowKey, 'salePrice', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)} placeholder="0" title="0 = no sale" className="w-20 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-100 placeholder:text-slate-500" />
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

        {/* ─── Default selection (what a brand-new user starts with) ─── */}
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <h2 className="font-medium text-slate-100 mb-2 flex items-center gap-2">
            <List className="w-4 h-4" />
            Default selection
          </h2>
          <p className="text-slate-400 text-xs mb-3">
            What a brand-new user starts this avatar with — one option per subcategory. Saved to
            <code className="bg-slate-700 px-1 rounded mx-1">avatar_catalogs.default_selection</code>
            and applied the moment you change a dropdown. Existing users keep their own selection.
          </p>

          <div className="mb-3 max-w-sm">
            <label className="block text-xs text-slate-400 mb-1">Avatar</label>
            <select
              value={defaultsSlug}
              onChange={(e) => void loadDefaultsForAvatar(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
            >
              <option value="">Select an avatar...</option>
              {listAvatars.map((a) => (
                <option key={a.avatarId} value={a.slug}>{a.avatarName} ({a.slug})</option>
              ))}
            </select>
          </div>

          {defaultsLoading && <p className="text-slate-400 text-sm">Loading catalog...</p>}

          {!defaultsLoading && defaultsSlug && defaultsCatalog.length === 0 && (
            <p className="text-amber-400 text-sm">No catalog saved for this avatar yet — sync its Spine assets first.</p>
          )}

          {!defaultsLoading && defaultsCatalog.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-600">
              <table className="w-full text-sm">
                <thead className="bg-slate-700 text-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2">Subcategory</th>
                    <th className="text-left px-3 py-2 w-64">Default option</th>
                    <th className="text-left px-3 py-2 w-20">Preview</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {defaultsCatalog.flatMap((cat) => cat.subcategories.map((sub) => {
                    const current = defaultsSel[sub.key] ?? '';
                    const chosen = sub.options.find((o) => o.optionId === current);
                    // Half of a dependent pair renders nothing on its own, so a default that
                    // sets one side and not the other leaves new users with missing art.
                    const partnerKey = sub.options[0]?.skinDeps?.replace(/^\//, '') ?? '';
                    const partnerMissing = !!partnerKey && !defaultsSel[partnerKey];
                    return (
                      <tr key={`${cat.key}/${sub.key}`} className="border-t border-slate-600">
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs">{sub.key}</span>
                          <span className="text-slate-500 text-xs ml-2">{cat.label}</span>
                          {partnerMissing && (
                            <p className="text-amber-400 text-[11px] mt-0.5">
                              pairs with &quot;{partnerKey}&quot; — set that one too, or this renders nothing
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={current}
                            disabled={savingDefaultKey === sub.key}
                            onChange={(e) => void setDefaultOption(sub.key, e.target.value)}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-xs disabled:opacity-50"
                          >
                            <option value="">(none)</option>
                            {sub.options.map((o) => (
                              <option key={o.optionId} value={o.optionId}>{o.label || o.optionId}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {chosen?.previewUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={chosen.previewUrl} alt={chosen.optionId} className="w-10 h-10 object-contain rounded bg-slate-900" />
                            : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          )}

          {defaultsStatus.result && <p className="mt-2 text-sm text-green-400">{defaultsStatus.result}</p>}
          {defaultsStatus.error && <p className="mt-2 text-sm text-red-400">{defaultsStatus.error}</p>}
        </div>

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
                onChange={(e) => {
                  const v = e.target.value;
                  setPreviewSlug(v);
                  setPreviewExists({});
                  if (v) loadCatalogForPreview(v);
                }}
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
                onChange={(e) => {
                  const v = e.target.value;
                  setPreviewSubcategory(v);
                  setPreviewOptionId('');
                  if (v && previewSlug) void checkPreviewsExist(previewSlug, v, previewCatalog);
                }}
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

          {previewSubcategory && previewSlug && (
            <div className="mb-3 p-3 rounded-lg bg-slate-900/80 border border-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-slate-300">Preview status ({previewSubcategory})</span>
                <div className="flex items-center gap-2">
                  {previewCheckLoading && <span className="text-xs text-slate-500">Checking…</span>}
                  <button
                    type="button"
                    disabled={previewCheckLoading || !previewSlug}
                    onClick={() => void checkPreviewsExist(previewSlug, previewSubcategory, previewCatalog)}
                    className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                  >
                    Re-check
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {previewCatalog.flatMap((cat) =>
                  cat.subcategories
                    .filter((sub) => sub.key === previewSubcategory)
                    .flatMap((sub) =>
                      sub.options.map((opt) => {
                        const k = `${previewSubcategory}/${opt.optionId}`;
                        const st = previewExists[k];
                        const label =
                          st === true ? 'On R2' : st === false ? 'Missing' : '…';
                        const cls =
                          st === true
                            ? 'bg-emerald-900/50 text-emerald-200 border-emerald-700'
                            : st === false
                              ? 'bg-amber-900/40 text-amber-200 border-amber-700'
                              : 'bg-slate-700 text-slate-400 border-slate-600';
                        return (
                          <button
                            key={opt.optionId}
                            type="button"
                            onClick={() => setPreviewOptionId(opt.optionId)}
                            title="Select this option for upload"
                            className={`px-2 py-1 rounded border ${cls} hover:opacity-90`}
                          >
                            <span className="font-mono">{opt.optionId}</span>
                            <span className="text-slate-400 mx-1">·</span>
                            {label}
                          </button>
                        );
                      }),
                    ),
                )}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipUploadIfPreviewExists}
                  onChange={(e) => setSkipUploadIfPreviewExists(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Skip upload if preview already on R2 (uncheck to overwrite)
              </label>
            </div>
          )}

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
