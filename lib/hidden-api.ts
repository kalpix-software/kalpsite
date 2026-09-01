import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// Typed wrappers over the hidden/admin_* RPC surface (Hidden Object Spec).
// Shapes mirror src/models/hidden.go's Admin* structs field for field — the
// backend is the source of truth; this file only names it for TypeScript.

export interface HiddenPack {
  packId: string;
  slug: string;
  name: string;
  description: string;
  coverUrl: string;
  itemId?: string;
  sequentialUnlock: boolean;
  sortOrder: number;
  isActive: boolean;
  sceneCount: number;
  levelCount: number;
  bundleVersion?: string;
}

export interface HiddenScene {
  sceneId: string;
  slug: string;
  name: string;
  thumbUrl: string;
  previewUrl: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  sizeBytes: number;
  itemId?: string;
  isFree: boolean;
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
  ingestWarnings?: string[];
}

export interface HiddenItem {
  idx: number;
  slug: string;
  name: string;
  iconUrl: string;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  difficulty: number;
  isActive: boolean;
}

export interface HiddenLevel {
  level: number;
  sceneId: string;
  sceneSlug: string;
  targetCount: number;
  timeLimitSec: number;
  isActive: boolean;
}

export interface IngestResult {
  sceneId: string;
  slug: string;
  width: number;
  height: number;
  imageUrl: string;
  thumbUrl: string;
  sizeBytes: number;
  items: HiddenItem[];
  retiredItems?: string[];
  skippedFiles?: string[];
  warnings?: string[];
}

export interface PublishBundleResult {
  scope: string;
  version: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  sceneCount: number;
}

export async function adminListPacks(): Promise<HiddenPack[]> {
  const raw = await callAdminRpc('hidden/admin_list_packs');
  return unwrapAdminRpcData<{ packs: HiddenPack[] }>(raw).packs ?? [];
}

export interface UpsertPackInput {
  packId?: string;
  slug: string;
  name: string;
  description: string;
  coverUrl: string;
  itemId?: string;
  sequentialUnlock: boolean;
  sortOrder: number;
}

export async function adminUpsertPack(input: UpsertPackInput): Promise<HiddenPack> {
  const raw = await callAdminRpc('hidden/admin_upsert_pack', JSON.stringify(input));
  return unwrapAdminRpcData<HiddenPack>(raw);
}

export async function adminSetPackActive(packId: string, active: boolean): Promise<void> {
  await callAdminRpc('hidden/admin_set_pack_active', JSON.stringify({ packId, active }));
}

export async function adminDeletePack(packId: string): Promise<void> {
  await callAdminRpc('hidden/admin_delete_pack', JSON.stringify({ packId }));
}

export async function adminListScenes(packId: string): Promise<HiddenScene[]> {
  const raw = await callAdminRpc('hidden/admin_list_scenes', JSON.stringify({ packId }));
  return unwrapAdminRpcData<{ scenes: HiddenScene[] }>(raw).scenes ?? [];
}

export async function adminListSceneItems(sceneId: string): Promise<HiddenItem[]> {
  const raw = await callAdminRpc('hidden/admin_list_scene_items', JSON.stringify({ sceneId }));
  return unwrapAdminRpcData<{ items: HiddenItem[] }>(raw).items ?? [];
}

export interface UpdateSceneInput {
  sceneId: string;
  name: string;
  itemId?: string;
  isFree: boolean;
  sortOrder: number;
}

export async function adminUpdateScene(input: UpdateSceneInput): Promise<void> {
  await callAdminRpc('hidden/admin_update_scene', JSON.stringify(input));
}

export async function adminSetSceneActive(sceneId: string, active: boolean): Promise<void> {
  await callAdminRpc('hidden/admin_set_scene_active', JSON.stringify({ sceneId, active }));
}

export async function adminDeleteScene(sceneId: string): Promise<void> {
  await callAdminRpc('hidden/admin_delete_scene', JSON.stringify({ sceneId }));
}

export async function adminListLevels(packId: string): Promise<HiddenLevel[]> {
  const raw = await callAdminRpc('hidden/admin_list_levels', JSON.stringify({ packId }));
  return unwrapAdminRpcData<{ levels: HiddenLevel[] }>(raw).levels ?? [];
}

export interface UpsertLevelInput {
  packId: string;
  level: number;
  sceneId: string;
  targetCount: number;
  timeLimitSec: number;
}

export async function adminUpsertLevel(input: UpsertLevelInput): Promise<void> {
  await callAdminRpc('hidden/admin_upsert_level', JSON.stringify(input));
}

export async function adminDeleteLevel(packId: string, level: number): Promise<void> {
  await callAdminRpc('hidden/admin_delete_level', JSON.stringify({ packId, level }));
}

/**
 * The one-upload ingest: presign, PUT the artist zip straight at R2 (the
 * binary never passes through Kalpsite's server), then ask the backend to
 * ingest the key. Returns the full ingest report — warnings included, which
 * the page MUST surface: an overlap warning is a content bug a player would
 * otherwise pay a life for.
 */
export async function ingestSceneZip(
  packId: string,
  slug: string,
  name: string,
  file: File,
  onPhase?: (phase: 'presign' | 'upload' | 'ingest') => void,
): Promise<IngestResult> {
  onPhase?.('presign');
  const beginRaw = await callAdminRpc('hidden/admin_ingest_begin', JSON.stringify({ filename: file.name }));
  const begin = unwrapAdminRpcData<{ key: string; uploadUrl: string; contentType: string }>(beginRaw);
  if (!begin?.uploadUrl || !begin?.key) throw new Error('Bad presign response');

  onPhase?.('upload');
  const put = await fetch(begin.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': begin.contentType || 'application/zip' },
    body: file,
  });
  if (!put.ok) throw new Error(`R2 PUT failed: ${put.status}`);

  onPhase?.('ingest');
  const raw = await callAdminRpc(
    'hidden/admin_ingest_scene',
    JSON.stringify({ packId, slug, name, key: begin.key }),
  );
  return unwrapAdminRpcData<IngestResult>(raw);
}

export async function adminPublishBundle(packId: string): Promise<PublishBundleResult> {
  const raw = await callAdminRpc('hidden/admin_publish_bundle', JSON.stringify({ packId }));
  return unwrapAdminRpcData<PublishBundleResult>(raw);
}
