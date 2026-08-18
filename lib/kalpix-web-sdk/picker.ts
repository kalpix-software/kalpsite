// Sticker picker wire contract.
//
// Field names come from src/services/picker/types.go, NOT from guesswork. The
// first version of this file read assetId/url/coverUrl — none of which the
// server sends (it sends stickerId/imageUrl/iconUrl), so every sticker was
// dropped and the picker rendered empty for a user who owned packs.
//
// picker/screen already INLINES the first 20 stickers of each pinned pack
// (PinnedPackTile.stickers), so opening the picker costs one call. Only paging
// past those 20 needs picker/pack_assets.
//
// Sending stays gated server-side: op 21 carries a stickerId and the backend
// re-checks ownership before resolving the art. This list is convenience only.

import type { KalpixHttp } from './rpc';

export interface PickerSticker {
  /** What op 21 sends. */
  stickerId: string;
  imageUrl: string;
  /** "standard" | "premium" — premium is gated per asset, not per pack. */
  tier?: string;
  owned?: boolean;
}

export interface PickerPack {
  packId: string;
  name: string;
  iconUrl?: string;
  stickers: PickerSticker[];
  stickersNextCursor?: string;
  stickersHasMore?: boolean;
}

interface StickerAssetTile {
  stickerId?: string;
  imageUrl?: string;
  tier?: string;
  owned?: boolean;
}

interface PinnedPackTile {
  packId?: string;
  name?: string;
  iconUrl?: string;
  stickers?: StickerAssetTile[];
  stickersHasMore?: boolean;
  stickersNextCursor?: string;
}

export interface TrendingPack {
  packId: string;
  name: string;
  iconUrl?: string;
}

interface TrendingPreviewTile {
  packId?: string;
  name?: string;
  iconUrl?: string;
}

interface ScreenResponse {
  pinnedPacks?: { items?: PinnedPackTile[] };
  trendingPreview?: TrendingPreviewTile[];
}

/**
 * Keep only stickers this user can actually send.
 *
 * Standard stickers inside a pinned pack are always owned. Premium ones are
 * gated individually, so an unowned premium sticker would look sendable and
 * then fail server-side with "you don't own this sticker".
 */
function sendable(raw: StickerAssetTile[] | undefined): PickerSticker[] {
  return (raw ?? [])
    .filter((s) => s.stickerId && s.imageUrl && s.owned !== false)
    .map((s) => ({
      stickerId: s.stickerId as string,
      imageUrl: s.imageUrl as string,
      tier: s.tier,
      owned: s.owned,
    }));
}

export class PickerApi {
  constructor(private readonly http: KalpixHttp) {}

  /**
   * One picker/screen call returning BOTH halves.
   *
   * Deliberately not two calls: the response already carries the pinned packs
   * (with each pack's first 20 stickers inlined) and the trending preview, so
   * asking twice would double the work and let the two halves disagree.
   */
  async screen(): Promise<{ packs: PickerPack[]; trending: TrendingPack[] }> {
    const res = await this.http.call<ScreenResponse>('picker/screen', { tab: 'stickers' });
    const packs = (res?.pinnedPacks?.items ?? [])
      .filter((p) => p.packId)
      .map((p) => ({
        packId: p.packId as string,
        name: p.name || 'Stickers',
        iconUrl: p.iconUrl,
        stickers: sendable(p.stickers),
        stickersHasMore: p.stickersHasMore,
        stickersNextCursor: p.stickersNextCursor,
      }));
    const trending = (res?.trendingPreview ?? [])
      .filter((t) => t.packId)
      .map((t) => ({ packId: t.packId as string, name: t.name || 'Pack', iconUrl: t.iconUrl }));
    return { packs, trending };
  }

  /** Pinned packs only. */
  async myPacks(): Promise<PickerPack[]> {
    const res = await this.http.call<ScreenResponse>('picker/screen', { tab: 'stickers' });
    return (res?.pinnedPacks?.items ?? [])
      .filter((p) => p.packId)
      .map((p) => ({
        packId: p.packId as string,
        name: p.name || 'Stickers',
        iconUrl: p.iconUrl,
        stickers: sendable(p.stickers),
        stickersHasMore: p.stickersHasMore,
        stickersNextCursor: p.stickersNextCursor,
      }));
  }

  /** Stickers past the inlined first page. */
  async morePackStickers(packId: string, cursor: string): Promise<PickerSticker[]> {
    if (!packId) return [];
    const res = await this.http.call<{ items?: StickerAssetTile[]; stickers?: StickerAssetTile[] }>(
      'picker/pack_assets',
      { packId, cursor, limit: 40 },
    );
    return sendable(res?.items ?? res?.stickers);
  }

  /**
   * Search the user's own stickers by tag or pack name.
   *
   * Response field is `ownedResults` (SearchResponse in services/picker/types.go),
   * NOT `owned.items` — an earlier version of this guessed the latter and so
   * search always came back empty.
   *
   * `catalogResults` (matches in packs the user has NOT bought) is ignored on
   * purpose: a sticker you cannot send has no place in a send picker, and
   * tapping one only produces a not-owned error from op 21.
   */
  async search(query: string): Promise<PickerSticker[]> {
    const q = query.trim();
    if (!q) return [];
    const res = await this.http.call<{ ownedResults?: StickerAssetTile[] }>(
      'picker/search',
      { tab: 'stickers', query: q, cursor: '', limit: 30 },
    );
    return sendable(res?.ownedResults);
  }

}
