/**
 * Client-side helpers for the Jigsaw admin RPCs.
 *
 * These TypeScript types mirror the Go structs in
 * kalpix-backend/src/models/jigsaw.go — field names here are that file's JSON
 * tags, so when the backend changes shape, update both sides together.
 *
 * RPCs used:
 *   - jigsaw/admin_list_packs
 *   - jigsaw/admin_upsert_pack
 *   - jigsaw/admin_set_pack_active
 *   - jigsaw/admin_delete_pack
 *   - jigsaw/admin_list_puzzles
 *   - jigsaw/admin_upsert_puzzle
 *   - jigsaw/admin_set_puzzle_active
 *   - jigsaw/admin_delete_puzzle
 *   - jigsaw/admin_list_daily
 *   - jigsaw/admin_set_daily
 *   - store/admin_get_upload_url          (shared presigner, see getUploadUrl)
 *
 * Catalog curation only. The session RPCs (start / merge / save layout /
 * complete) are the player app's and are deliberately absent here: a board is
 * progressed by joining pieces, which is not something an admin panel can or
 * should do.
 *
 * All admin-gated on the backend; the /api/admin/rpc proxy handles auth. Each
 * `jigsaw/admin_*` id must also be listed in ALLOWED_ADMIN_RPC_IDS in
 * app/api/admin/rpc/route.ts or the proxy rejects it before the backend sees it.
 */

// unwrapAdminRpcData is the SHARED unwrapper on purpose. store-api.ts keeps a
// private copy that peels with `?? raw` instead of an undefined check, so a
// backend reply of `data: null` there yields the whole envelope rather than
// null — a divergence worth avoiding on a surface that returns nullable rows.
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// ----------------------------------------------------------------------------
// Collections — the shop's filter chips, and the pack form's dropdown.
// ----------------------------------------------------------------------------

/**
 * jigsaw_packs.collection is a free-text VARCHAR tag, not a foreign key, so the
 * curated set below is a convention rather than a constraint. It exists to stop
 * the chip row fragmenting into `travel`, `Travel` and `travels`.
 */
export const COLLECTIONS = [
  'mystery',
  'summer',
  'travel',
  'landscape',
  'classic',
  'animals',
  'flowers',
  'cities',
] as const;

export type CollectionKey = (typeof COLLECTIONS)[number];

export const COLLECTION_LABEL: Record<CollectionKey, string> = {
  mystery: 'Mystery',
  summer: 'Summer',
  travel: 'Travel',
  landscape: 'Landscape',
  classic: 'Classic',
  animals: 'Animals',
  flowers: 'Flowers',
  cities: 'Cities',
};

/**
 * Display label for any collection key, curated or not. Because the column is
 * free text, a pack may already hold a key this build has never heard of — the
 * dropdown has to keep rendering it instead of silently reassigning the pack to
 * the first option it recognises. Empty stays empty; the form labels its own
 * "no collection" choice.
 */
export function collectionLabel(key: string): string {
  if (!key) return '';
  if (key in COLLECTION_LABEL) return COLLECTION_LABEL[key as CollectionKey];
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ----------------------------------------------------------------------------
// Catalog wire shapes.
// ----------------------------------------------------------------------------

/** Exactly one currency per pack — never both, never real money. */
export interface JigsawPrice {
  currencyType: 'coins' | 'gems';
  amount: number;
  discountedAmount: number;
  discountedPercent: number;
  /** Unix seconds; 0 = no deadline. */
  availableUntil: number;
}

/**
 * A purchasable collection of puzzles, and the only thing in this game with a
 * price — puzzles have no store_items row at all.
 *
 * Mind the two ids: `packItemId` is this row's own pack_id, while `itemId` is
 * the store_items row that grants it (empty = free pack). The admin writes
 * below take the pack's id as `packId`, a third spelling of the first one.
 */
export interface JigsawPack {
  packItemId: string;
  slug: string;
  name: string;
  description?: string;
  coverUrl?: string;
  collection?: string;
  /** Server-resolved display name for `collection`. */
  collectionName?: string;
  itemId?: string;
  puzzleCount: number;
  downloads: number;
  sortOrder: number;
  isActive: boolean;
  isFree: boolean;
  isOwned: boolean;
  /** Omitted entirely once owned, so an owned pack cannot render a price. */
  price?: JigsawPrice;
  rarity?: string;
  badges?: string[];
  releasedAt?: number;
  /** Per-user; zero on the admin list, which reads nobody's progress. */
  completedCount: number;
  inProgressCount: number;
  createdAt?: number;
  updatedAt?: number;
}

export type JigsawProgressState = 'not_started' | 'in_progress' | 'completed';

/** The per-user badge on a puzzle tile. */
export interface JigsawPuzzleProgress {
  state: JigsawProgressState;
  percent: number;
  pieceCount?: number;
  sessionId?: string;
  bestTimeMs?: number;
  timesSolved?: number;
  lastPlayedAt?: number;
}

/**
 * One image inside a pack. Never priced.
 *
 * Three image fields, three jobs: `thumbUrl` for grid tiles, `previewUrl` for
 * the settings sheet, `imageUrl` for the board only — and `imageUrl` is
 * withheld from players until the pack is owned, so an admin form that saves it
 * back must always post the value it loaded, never a blank.
 */
export interface JigsawPuzzle {
  puzzleId: string;
  slug?: string;
  packItemId?: string;
  packName?: string;
  name: string;
  imageUrl?: string;
  thumbUrl?: string;
  previewUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  sizeBytes?: number;
  /** Width / height — lets a grid size its tile before the image lands. */
  aspectRatio?: number;
  isFree: boolean;
  isLocked: boolean;
  sortOrder: number;
  isActive: boolean;
  progress?: JigsawPuzzleProgress;
  createdAt?: number;
  updatedAt?: number;
}

// ----------------------------------------------------------------------------
// Packs — admin reads and writes.
// ----------------------------------------------------------------------------

/**
 * Create (omit `packId`) or edit (send it) a pack.
 *
 * Every optional field is PATCH semantics: the backend reads them as pointers,
 * so an absent key means "leave alone". JSON.stringify drops `undefined` keys,
 * which is precisely how absence is expressed — hand it `undefined`, not `''`,
 * for anything the form did not touch. The distinction is load-bearing on
 * `itemId`, where `''` clears the store item and turns the pack free while
 * `undefined` keeps whatever it is priced at today.
 */
export interface AdminUpsertPackRequest {
  packId?: string;
  slug: string;
  name?: string;
  description?: string;
  coverUrl?: string;
  collection?: string;
  itemId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/** Admin list — unlike every player read, this includes inactive packs. */
export interface AdminListPacksResponse {
  packs: JigsawPack[];
}

/**
 * A write echoes the row it just wrote. The Go field is a pointer, but a
 * response only reaches here after callAdminRpc has thrown on `success: false`,
 * so on this path it is always populated.
 */
export interface AdminPackResponse {
  pack: JigsawPack;
}

export interface AdminPuzzleResponse {
  puzzle: JigsawPuzzle;
}

/** The shape of the payload-less admin successes. */
export interface JigsawOkResponse {
  updated?: boolean;
  deleted?: boolean;
}

export async function adminListPacks(): Promise<AdminListPacksResponse> {
  const raw = await callAdminRpc('jigsaw/admin_list_packs', JSON.stringify({}));
  return unwrapAdminRpcData<AdminListPacksResponse>(raw);
}

export async function adminUpsertPack(req: AdminUpsertPackRequest): Promise<AdminPackResponse> {
  const raw = await callAdminRpc('jigsaw/admin_upsert_pack', JSON.stringify(req));
  return unwrapAdminRpcData<AdminPackResponse>(raw);
}

/** Shelf state, not deletion — owners keep an inactive pack and can still play it. */
export async function adminSetPackActive(packId: string, isActive: boolean): Promise<JigsawOkResponse> {
  const raw = await callAdminRpc('jigsaw/admin_set_pack_active', JSON.stringify({ packId, isActive }));
  return unwrapAdminRpcData<JigsawOkResponse>(raw);
}

/** Cascades to the pack's puzzles, and through them to every session on one. */
export async function adminDeletePack(packId: string): Promise<JigsawOkResponse> {
  const raw = await callAdminRpc('jigsaw/admin_delete_pack', JSON.stringify({ packId }));
  return unwrapAdminRpcData<JigsawOkResponse>(raw);
}

// ----------------------------------------------------------------------------
// Puzzles — admin reads and writes.
// ----------------------------------------------------------------------------

/** Create (omit `puzzleId`) or edit (send it) a puzzle. PATCH semantics as above. */
export interface AdminUpsertPuzzleRequest {
  puzzleId?: string;
  slug: string;
  /** Required on both create and edit: it is what a puzzle belongs to. */
  packId: string;
  name?: string;
  imageUrl?: string;
  thumbUrl?: string;
  previewUrl?: string;
  /**
   * The source image's true pixel dimensions. Not cosmetic: the legal piece
   * counts are derived from the aspect ratio, so a wrong or missing pair ships
   * a wrong slider — 42 pieces is 7x6 for a landscape image and 6x7 for a
   * portrait one.
   */
  imageWidth?: number;
  imageHeight?: number;
  /** Byte size of imageUrl, so the board shows a real progress bar. 0 = unknown. */
  sizeBytes?: number;
  isFree?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface AdminListPuzzlesResponse {
  puzzles: JigsawPuzzle[];
}

export async function adminListPuzzles(packId: string): Promise<AdminListPuzzlesResponse> {
  // includeInactive is always true here, and that is not a shortcut. This is the
  // admin console: it renders an Unpublish/Restore toggle per puzzle, so hiding
  // inactive rows would make Restore unreachable — unpublish a puzzle and it
  // vanishes with no way back. The player-facing reads filter on is_active
  // server-side and never come through this function.
  const raw = await callAdminRpc(
    'jigsaw/admin_list_puzzles',
    JSON.stringify({ packId, includeInactive: true }),
  );
  return unwrapAdminRpcData<AdminListPuzzlesResponse>(raw);
}

export async function adminUpsertPuzzle(req: AdminUpsertPuzzleRequest): Promise<AdminPuzzleResponse> {
  const raw = await callAdminRpc('jigsaw/admin_upsert_puzzle', JSON.stringify(req));
  return unwrapAdminRpcData<AdminPuzzleResponse>(raw);
}

export async function adminSetPuzzleActive(puzzleId: string, isActive: boolean): Promise<JigsawOkResponse> {
  const raw = await callAdminRpc('jigsaw/admin_set_puzzle_active', JSON.stringify({ puzzleId, isActive }));
  return unwrapAdminRpcData<JigsawOkResponse>(raw);
}

/**
 * Deletes the image from the catalog and every session on it. Prefer
 * adminSetPuzzleActive(false) for anything a player may be mid-board on.
 */
export async function adminDeletePuzzle(puzzleId: string): Promise<JigsawOkResponse> {
  const raw = await callAdminRpc('jigsaw/admin_delete_puzzle', JSON.stringify({ puzzleId }));
  return unwrapAdminRpcData<JigsawOkResponse>(raw);
}

// ----------------------------------------------------------------------------
// Daily free puzzle — an admin-filled schedule, one puzzle per date.
// ----------------------------------------------------------------------------

export interface AdminSetDailyRequest {
  /** YYYY-MM-DD. The date is the primary key, so re-sending one reassigns it. */
  playDate: string;
  puzzleId: string;
}

/** One row of the schedule; name and thumb are joined in so the list is readable. */
export interface AdminDailyEntry {
  playDate: string;
  puzzleId: string;
  puzzleName?: string;
  thumbUrl?: string;
}

export interface AdminDailyListResponse {
  entries: AdminDailyEntry[];
}

export async function adminListDaily(): Promise<AdminDailyListResponse> {
  const raw = await callAdminRpc('jigsaw/admin_list_daily', JSON.stringify({}));
  return unwrapAdminRpcData<AdminDailyListResponse>(raw);
}

/**
 * Schedule (or reassign) the daily free puzzle. The chosen puzzle is playable
 * that day whether or not its pack is owned, which makes this the game's main
 * shop window — scheduling from a pack nobody owns is the point, not a mistake.
 */
export async function adminSetDaily(req: AdminSetDailyRequest): Promise<JigsawOkResponse> {
  const raw = await callAdminRpc('jigsaw/admin_set_daily', JSON.stringify(req));
  return unwrapAdminRpcData<JigsawOkResponse>(raw);
}

// ----------------------------------------------------------------------------
// Uploads — presign, then PUT straight to R2 from the browser.
// ----------------------------------------------------------------------------

export interface UploadUrlResponse {
  /** Presigned PUT target. Short-lived — presign per upload, never cache it. */
  uploadUrl: string;
  /** Where the object will be readable once the PUT succeeds. */
  publicUrl: string;
}

/**
 * Presign one object. Shared with every other admin surface rather than given a
 * jigsaw-owned twin: `fileName` drives a deterministic R2 key, so re-uploading
 * the same name overwrites in place and no orphan accumulates.
 *
 * The caller does the PUT itself — a 2048px puzzle master must not be relayed
 * through the Next proxy's function budget.
 */
export async function getUploadUrl(
  itemType: string,
  category: string,
  subcategory: string,
  fileName: string,
  contentType: string,
): Promise<UploadUrlResponse> {
  const raw = await callAdminRpc('store/admin_get_upload_url', JSON.stringify({ itemType, category, subcategory, fileName, contentType }));
  return unwrapAdminRpcData<UploadUrlResponse>(raw);
}
