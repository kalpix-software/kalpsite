/**
 * Client-side helpers for the cross-vertical Shop admin RPCs.
 *
 * These TypeScript types mirror the Go structs in
 * kalpix-backend/src/services/shop — when backend changes shape, update
 * both sides together.
 *
 * RPCs used (Slice 4b — chat redesign):
 *   - shop/admin_set_featured              (set the All-tab featured carousel)
 *   - shop/admin_list_featured             (current featured set + admin metadata)
 *
 * The matching player-facing read RPC is `shop/get_all_preview`; admin
 * writes here invalidate its compound ETag (`chat:N|featured:M`) by
 * bumping `shop_featured_versions.version` transactionally.
 *
 * All admin-gated on the backend; the /api/admin/rpc proxy handles auth.
 */

import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// ----------------------------------------------------------------------------
// Featured items — cross-vertical highlights for the shop's All tab.
// ----------------------------------------------------------------------------

/**
 * The vertical the featured item lives in. Determines:
 *  - Which player UI surface routes when the user taps the tile.
 *  - Which detail tables the backend joins for display fields.
 *
 * The backend rejects mismatches between `kind` and the item's
 * store_items.vertical, so admins can't accidentally tag a chat theme
 * as a game item.
 */
export type FeaturedKind = 'chat' | 'avatar' | 'game';

export const FEATURED_KIND_LABEL: Record<FeaturedKind, string> = {
  chat: 'Chat',
  avatar: 'Avatar',
  game: 'Game',
};

export interface FeaturedItemRequest {
  itemId: string;
  kind: FeaturedKind;
  /**
   * Render order on the All-tab carousel. Lower = earlier. Ties break by
   * itemId. Admins typically set 0..N-1 in the order they want.
   */
  sortOrder: number;
}

export interface SetFeaturedRequest {
  /**
   * Up to 10 items. The backend replaces the entire featured list
   * atomically (DELETE + bulk INSERT + version bump in one tx); there's
   * no "add one" or "remove one" — always send the full list.
   */
  items: FeaturedItemRequest[];
}

export interface SetFeaturedResponse {
  ok: boolean;
  /**
   * The new shop_featured_versions.version after the write. Pin this
   * etag locally so the admin dashboard can detect drift if another
   * admin writes concurrently.
   */
  version: number;
}

/**
 * Atomically replace the entire featured list. The backend validates
 * each item exists and is active inside the same transaction; archived
 * items are rejected.
 */
export async function setFeatured(req: SetFeaturedRequest): Promise<SetFeaturedResponse> {
  const raw = await callAdminRpc('shop/admin_set_featured', JSON.stringify(req));
  return unwrapAdminRpcData<SetFeaturedResponse>(raw);
}

// ----------------------------------------------------------------------------
// Listing the current featured set.
// ----------------------------------------------------------------------------

export interface ListFeaturedItem {
  itemId: string;
  kind: FeaturedKind;
  sortOrder: number;
  /** Display name from store_items.name. */
  name: string;
  /** Display preview URL from store_items.icon_url. May be empty. */
  previewUrl: string;
  /** UUID of the admin who added the entry (audit metadata). */
  addedBy: string;
  /** Unix seconds. */
  addedAt: number;
}

export interface ListFeaturedResponse {
  items: ListFeaturedItem[];
  /** Current shop_featured_versions counter. */
  version: number;
}

/**
 * Fetch the current featured carousel with admin metadata. Identical
 * shape to what the player UI sees via `shop/get_all_preview` plus the
 * `addedBy` and `addedAt` audit fields the player tier strips.
 */
export async function listFeatured(): Promise<ListFeaturedResponse> {
  const raw = await callAdminRpc('shop/admin_list_featured', JSON.stringify({}));
  return unwrapAdminRpcData<ListFeaturedResponse>(raw);
}
