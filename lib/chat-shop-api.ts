/**
 * Client-side helpers for the Chat Shop admin RPCs.
 *
 * These TypeScript types mirror the Go structs in
 * kalpix-backend/src/services/chatshop — when backend changes shape, update
 * both sides together.
 *
 * RPCs used:
 *   - chat_shop/admin_upsert_item              (UpsertItem)
 *   - chat_shop/admin_publish_item
 *   - chat_shop/admin_archive_item
 *   - chat_shop/admin_list_items
 *   - chat_shop/admin_grant_item
 *
 * All are admin-gated on the backend; the /api/admin/rpc proxy handles auth.
 */

import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// ----------------------------------------------------------------------------
// Subcategories + literal-string enum helpers.
// ----------------------------------------------------------------------------

export const SUBCATEGORIES = [
  'theme',
  'bubble_style',
  'background',
  'font',
  'emote_pack',
  'sticker_pack',
  'gif_pack',
] as const;

export type Subcategory = (typeof SUBCATEGORIES)[number];

export const SUBCATEGORY_LABEL: Record<Subcategory, string> = {
  theme: 'Themes',
  bubble_style: 'Bubble styles',
  background: 'Backgrounds',
  font: 'Fonts',
  emote_pack: 'Emote packs',
  sticker_pack: 'Sticker packs',
  gif_pack: 'GIF packs',
};

export type ItemStatus = 'draft' | 'active' | 'hidden' | 'archived';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Currency = 'coins' | 'gems' | 'free';

// ----------------------------------------------------------------------------
// Wire shapes for chat_shop/admin_upsert_item.
// ----------------------------------------------------------------------------

export interface Rect { x: number; y: number; w: number; h: number }
export interface Padding { t: number; r: number; b: number; l: number }

export interface BubbleStyleAssets {
  sentImageUrl: string;
  sentCenterSlice: Rect;
  sentPadding: Padding;
  sentTextColor: string;
  receivedImageUrl: string;
  receivedCenterSlice: Rect;
  receivedPadding: Padding;
  receivedTextColor: string;
  timestampColor: string;
  minBubbleWidthPx: number;
}

export interface BackgroundAssets {
  imageUrl: string;
  blurhash: string;
  widthPx: number;
  heightPx: number;
  tileable: boolean;
}

export interface FontAssets {
  fontFamily: string;
  fontFileUrl: string;
  supportedWeights: number[];
  fallbackFamily: string;
  licenseUrl: string;
}

export interface ThemeAssets {
  bubbleStyleId?: string;
  backgroundId?: string;
  fontId?: string;
  accentColor: string;
}

export interface PackItem {
  mediaUrl: string;
  previewUrl?: string;  // gif packs only
  shortcode?: string;   // emote packs only
  tags: string[];
  sortOrder: number;
  // Per-sticker pricing (sticker packs only; ignored for gif/emote packs).
  // `tier` omitted/"" => standard. A premium sticker must have EXACTLY ONE of
  // priceCoins/priceGems > 0; a standard sticker must have both = 0. The server
  // validates this in SyncPackItem and, for premium items, mints a per-sticker
  // store_item so the sticker can be individually purchased.
  tier?: 'standard' | 'premium';
  priceCoins?: number;
  priceGems?: number;
}

export interface PackAssets {
  coverUrl: string;
  items?: PackItem[];
}

export interface SyncAssetsEnvelope {
  bubbleStyle?: BubbleStyleAssets;
  background?: BackgroundAssets;
  font?: FontAssets;
  theme?: ThemeAssets;
  pack?: PackAssets;
}

export interface SyncItemRequest {
  itemId?: string;
  subcategory: Subcategory;
  slug: string;
  name: string;
  description: string;
  iconUrl: string;
  previewUrl: string;
  // Price shape mirrors avatar/store: scalar `price` + sibling `currencyType`,
  // plus optional `discountedPrice` (must share the same currency). The server
  // computes `discountedPercent` on read and does not accept it here.
  currencyType: Currency;
  price: number;
  discountedPrice?: number;
  rarity: Rarity;
  status: ItemStatus;
  sortOrder: number;
  isDefault: boolean;
  previewAllowed: boolean;
  availableFrom?: number; // unix seconds
  availableUntil?: number;
  assets: SyncAssetsEnvelope;
}

export interface SyncItemResponse {
  itemId: string;
  shopVersion: number;
}

// ----------------------------------------------------------------------------
// Admin list.
// ----------------------------------------------------------------------------

export interface AdminListItem {
  itemId: string;
  subcategory: string;
  slug: string;
  name: string;
  /** Round-tripped on edit so the form pre-fills correctly. */
  description: string;
  /** Round-tripped on edit so the form pre-fills correctly. */
  iconUrl: string;
  /** Round-tripped on edit so the form pre-fills correctly. */
  previewUrl: string;
  status: ItemStatus;
  isDefault: boolean;
  rarity: Rarity;
  updatedAt: number;
}

export interface AdminListResponse {
  items: AdminListItem[];
  /** base64-URL keyset cursor; empty when there are no more pages. */
  nextCursor: string;
  total: number;
}

export async function listItemsAdmin(opts: {
  subcategory?: Subcategory;
  statuses?: ItemStatus[];
  limit?: number;
  /** Pass `nextCursor` from the previous page; empty/undefined → first page. */
  cursor?: string;
} = {}): Promise<AdminListResponse> {
  const raw = await callAdminRpc('chat_shop/admin_list_items', JSON.stringify({
    subcategory: opts.subcategory || '',
    statuses: opts.statuses || [],
    limit: opts.limit ?? 50,
    cursor: opts.cursor || '',
  }));
  return unwrapAdminRpcData<AdminListResponse>(raw);
}

export async function upsertItem(req: SyncItemRequest): Promise<SyncItemResponse> {
  const raw = await callAdminRpc('chat_shop/admin_upsert_item', JSON.stringify(req));
  return unwrapAdminRpcData<SyncItemResponse>(raw);
}

// getPackAssets loads a pack's full editable assets (cover + items with
// tier/price/tags) for the edit form. The admin list row does NOT carry
// assets, so without this the form opens empty and a Save — which replaces
// the asset list wholesale — would wipe the pack.
export async function getPackAssets(itemId: string): Promise<PackAssets> {
  const raw = await callAdminRpc('chat_shop/admin_get_pack', JSON.stringify({ itemId }));
  const data = unwrapAdminRpcData<PackAssets>(raw);
  return { coverUrl: data.coverUrl ?? '', items: data.items ?? [] };
}

export async function publishItem(itemId: string): Promise<{ shopVersion: number }> {
  const raw = await callAdminRpc('chat_shop/admin_publish_item', JSON.stringify({ itemId }));
  return unwrapAdminRpcData<{ shopVersion: number }>(raw);
}

export async function archiveItem(itemId: string): Promise<{ shopVersion: number }> {
  const raw = await callAdminRpc('chat_shop/admin_archive_item', JSON.stringify({ itemId }));
  return unwrapAdminRpcData<{ shopVersion: number }>(raw);
}

export interface GrantRequest {
  userId: string;
  itemId: string;
  source?: 'gift' | 'reward' | 'admin_grant' | 'promo';
  endsAt?: number;
  /**
   * Optional client-generated UUID. When provided, the backend deduplicates
   * retries with the same `requestId` for 24h via the shared idempotency
   * store (see middleware/idempotency.go). Strongly recommended for any
   * write triggered by a UI action.
   */
  requestId?: string;
}

export async function grantItem(req: GrantRequest): Promise<{ granted: boolean; inventoryAdds: string[] }> {
  const raw = await callAdminRpc('chat_shop/admin_grant_item', JSON.stringify(req));
  return unwrapAdminRpcData<{ granted: boolean; inventoryAdds: string[] }>(raw);
}

// ----------------------------------------------------------------------------
// Slice 4b — chat_shop/admin_set_trending.
// Replaces the trending pack list for one pack kind atomically. Powers the
// picker's trending carousel (inside picker/screen) and the trending list
// page (picker/trending). Per-kind atomic replace — changing sticker
// trending leaves gif and emote rows untouched.
// ----------------------------------------------------------------------------

export type PackKind = 'sticker' | 'gif' | 'emote';

export const PACK_KIND_LABEL: Record<PackKind, string> = {
  sticker: 'Sticker packs',
  gif: 'GIF packs',
  emote: 'Emote packs',
};

export interface TrendingPackEntry {
  packId: string;
  rank: number;
}

export interface SetTrendingRequest {
  packKind: PackKind;
  items: TrendingPackEntry[];
}

export interface SetTrendingResponse {
  ok: boolean;
  count: number;
}

export async function setTrendingPacks(req: SetTrendingRequest): Promise<SetTrendingResponse> {
  const raw = await callAdminRpc('chat_shop/admin_set_trending', JSON.stringify(req));
  return unwrapAdminRpcData<SetTrendingResponse>(raw);
}

// chat_shop/admin_list_trending — read counterpart of setTrendingPacks.
// Returns the currently-published trending entries for one pack kind,
// ordered by rank ascending, with the parent pack name joined in so the
// editor can show "Music Stickers (uuid)" instead of a bare UUID.

export interface ListTrendingItem {
  packId: string;
  rank: number;
  /** store_items.name for the pack — empty string if the row was archived. */
  packName: string;
}

export interface ListTrendingResponse {
  items: ListTrendingItem[];
}

export async function listTrendingPacks(packKind: PackKind): Promise<ListTrendingResponse> {
  const raw = await callAdminRpc('chat_shop/admin_list_trending', JSON.stringify({ packKind }));
  return unwrapAdminRpcData<ListTrendingResponse>(raw);
}

// ----------------------------------------------------------------------------
// CDN upload wrapper — reuses /api/admin/upload (itemType=chat_item).
// Returns { publicUrl, key } so a form can drop the URL directly into the
// matching asset field.
// ----------------------------------------------------------------------------

export async function uploadChatAsset(
  file: File,
  subcategory: Subcategory,
): Promise<{ publicUrl: string; key: string }> {
  const fd = new FormData();
  fd.append('itemType', 'chat_item');
  fd.append('category', 'chat');
  fd.append('subcategory', subcategory);
  fd.append('fileName', file.name);
  fd.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok || !data.publicUrl) {
    throw new Error(data.error ? String(data.error) : 'Upload failed');
  }
  return { publicUrl: data.publicUrl, key: data.key };
}
