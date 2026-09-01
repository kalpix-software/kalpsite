'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  ListOrdered,
  Lock,
  Package,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  HiddenItem,
  HiddenLevel,
  HiddenPack,
  HiddenScene,
  IngestResult,
  adminDeleteLevel,
  adminDeletePack,
  adminDeleteScene,
  adminListLevels,
  adminListPacks,
  adminListSceneItems,
  adminListScenes,
  adminPublishBundle,
  adminSetPackActive,
  adminSetSceneActive,
  adminUpdateScene,
  adminUpsertLevel,
  adminUpsertPack,
  ingestSceneZip,
} from '@/lib/hidden-api';

// Hidden Object admin — packs, the scenes inside them, the level ladder,
// and the one-upload ingest flow.
//
// The upload contract is deliberately "the artist folder, zipped, as
// delivered": exactly one image whose name contains "without" (the clean
// plate), full-canvas "* masked.png" layers, and anything else — the
// reference composite, detached icon renders — is skipped server-side and
// reported back. No renaming, no resizing, ever.
//
// Access model (owner decision 2026-09-01), all three gates editable here:
//   pack paid   -> pack form's Store Item field
//   scene paid  -> scene editor's Store Item field (free pack, paid scene)
//   sequential  -> the pack's "previous level must be solved" toggle
//
// Ingest warnings are surfaced loudly on purpose: an overlap warning is a
// content bug a player would otherwise pay a life for.

const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm';
const btnCls = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
const btnPrimary = `${btnCls} bg-emerald-600 hover:bg-emerald-500 text-white`;
const btnGhost = `${btnCls} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600`;
const btnDanger = `${btnCls} bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-800`;

function fmtBytes(n: number): string {
  if (!n) return '—';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HiddenAdminPage() {
  const [packs, setPacks] = useState<HiddenPack[]>([]);
  const [selected, setSelected] = useState<HiddenPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (keepSelection = true) => {
    setLoading(true);
    setError('');
    try {
      const list = await adminListPacks();
      setPacks(list);
      setSelected((prev) => {
        if (!keepSelection || !prev) return prev;
        return list.find((p) => p.packId === prev.packId) ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Search className="w-6 h-6 text-emerald-400" /> Hidden Object
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Packs, scenes and the level ladder. Upload the artist folder as a zip — everything else is derived.
          </p>
        </div>
        <button className={btnGhost} onClick={() => void refresh()}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-900/40 border border-red-800 text-red-200 text-sm">{error}</div>}
      {notice && (
        <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-800 text-emerald-200 text-sm">{notice}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <PackList
            packs={packs}
            loading={loading}
            selected={selected}
            onSelect={setSelected}
            onChanged={() => void refresh()}
            onError={setError}
          />
        </div>
        <div className="xl:col-span-2 space-y-6">
          {selected ? (
            <PackDetail
              key={selected.packId}
              pack={selected}
              onChanged={() => void refresh()}
              onError={setError}
              onNotice={setNotice}
            />
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm text-center">
              Select a pack — or create one — to manage its scenes and ladder.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pack list + editor
// ---------------------------------------------------------------------------

function PackList({
  packs,
  loading,
  selected,
  onSelect,
  onChanged,
  onError,
}: {
  packs: HiddenPack[];
  loading: boolean;
  selected: HiddenPack | null;
  onSelect: (p: HiddenPack) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<HiddenPack | 'new' | null>(null);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2">
          <Package className="w-4 h-4" /> Packs
        </h2>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" /> New pack
        </button>
      </div>

      {editing && (
        <PackForm
          pack={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null);
            onChanged();
          }}
          onCancel={() => setEditing(null)}
          onError={onError}
        />
      )}

      <div className="divide-y divide-slate-700/60">
        {loading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
        {!loading && packs.length === 0 && <div className="p-4 text-sm text-slate-500">No packs yet.</div>}
        {packs.map((p) => (
          <div
            key={p.packId}
            className={`p-4 cursor-pointer hover:bg-slate-800/60 ${
              selected?.packId === p.packId ? 'bg-slate-800/80 border-l-2 border-emerald-500' : ''
            }`}
            onClick={() => onSelect(p)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-slate-100 font-medium truncate flex items-center gap-2">
                  {p.name || p.slug}
                  {!p.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">HIDDEN</span>}
                  {p.itemId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">PAID</span>}
                  {p.sequentialUnlock && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-300 inline-flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> SEQ
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.sceneCount} scenes · {p.levelCount} levels · bundle {p.bundleVersion || '—'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                  title="Edit pack"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(p);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                  title={p.isActive ? 'Hide from players' : 'Show to players'}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await adminSetPackActive(p.packId, !p.isActive);
                      onChanged();
                    } catch (err) {
                      onError(err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                >
                  <Power className={`w-4 h-4 ${p.isActive ? 'text-emerald-400' : ''}`} />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-red-900/60 text-slate-400 hover:text-red-300"
                  title="Delete pack (scenes, levels and player progress cascade)"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Delete pack "${p.name || p.slug}"?\n\nScenes, levels, sessions and player progress all cascade. This cannot be undone.`)) return;
                    try {
                      await adminDeletePack(p.packId);
                      onChanged();
                    } catch (err) {
                      onError(err instanceof Error ? err.message : 'Failed');
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackForm({
  pack,
  onDone,
  onCancel,
  onError,
}: {
  pack: HiddenPack | null;
  onDone: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [slug, setSlug] = useState(pack?.slug ?? '');
  const [name, setName] = useState(pack?.name ?? '');
  const [description, setDescription] = useState(pack?.description ?? '');
  const [coverUrl, setCoverUrl] = useState(pack?.coverUrl ?? '');
  const [itemId, setItemId] = useState(pack?.itemId ?? '');
  const [sequential, setSequential] = useState(pack?.sequentialUnlock ?? true);
  const [sortOrder, setSortOrder] = useState(pack?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);

  return (
    <div className="p-4 border-b border-slate-700 bg-slate-900/60 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="slug (e.g. pirate_cove)" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!!pack} />
        <input className={inputCls} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <input className={inputCls} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input className={inputCls} placeholder="Cover image URL" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="Store item ID (leave empty = free pack)"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        />
        <input
          className={inputCls}
          type="number"
          placeholder="Sort order"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
        <input type="checkbox" checked={sequential} onChange={(e) => setSequential(e.target.checked)} />
        <Lock className="w-3.5 h-3.5 text-sky-400" />
        Sequential unlock — a level opens only when the previous one is solved. Untick to open every level (payment gates still apply).
      </label>
      <div className="flex gap-2 justify-end">
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
        <button
          className={btnPrimary}
          disabled={saving || !slug.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await adminUpsertPack({
                packId: pack?.packId,
                slug: slug.trim(),
                name: name.trim(),
                description: description.trim(),
                coverUrl: coverUrl.trim(),
                itemId: itemId.trim() || undefined,
                sequentialUnlock: sequential,
                sortOrder,
              });
              onDone();
            } catch (err) {
              onError(err instanceof Error ? err.message : 'Failed to save pack');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Save className="w-4 h-4" /> {pack ? 'Save pack' : 'Create pack'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pack detail: scenes, ingest, ladder, bundle
// ---------------------------------------------------------------------------

function PackDetail({
  pack,
  onChanged,
  onError,
  onNotice,
}: {
  pack: HiddenPack;
  onChanged: () => void;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
}) {
  const [scenes, setScenes] = useState<HiddenScene[]>([]);
  const [levels, setLevels] = useState<HiddenLevel[]>([]);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sc, lv] = await Promise.all([adminListScenes(pack.packId), adminListLevels(pack.packId)]);
      setScenes(sc);
      setLevels(lv);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load pack content');
    }
  }, [pack.packId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <IngestPanel
        pack={pack}
        onIngested={(r) => {
          onNotice(
            `Ingested "${r.slug}" — ${r.items.length} items, ${fmtBytes(r.sizeBytes)} composite` +
              (r.warnings?.length ? ` · ${r.warnings.length} warning(s) below` : ' · no warnings'),
          );
          void load();
          onChanged();
        }}
        onError={onError}
      />
      <SceneTable pack={pack} scenes={scenes} onChanged={() => { void load(); onChanged(); }} onError={onError} />
      <LadderEditor pack={pack} scenes={scenes} levels={levels} onChanged={() => { void load(); onChanged(); }} onError={onError} />

      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 flex items-center justify-between">
        <div className="text-sm text-slate-300">
          <div className="font-semibold text-slate-200">Publish content bundle</div>
          <div className="text-slate-500 text-xs mt-0.5">
            Zips every active scene (clean plate + layers + icons + manifest) and publishes hidden:{pack.slug}. Players
            download the new version on their next library visit. Current: {pack.bundleVersion || 'never published'}.
          </div>
        </div>
        <button
          className={btnPrimary}
          disabled={publishing || scenes.filter((s) => s.isActive).length === 0}
          onClick={async () => {
            setPublishing(true);
            try {
              const r = await adminPublishBundle(pack.packId);
              onNotice(`Published ${r.scope} ${r.version} — ${r.sceneCount} scenes, ${fmtBytes(r.sizeBytes)}`);
              onChanged();
            } catch (e) {
              onError(e instanceof Error ? e.message : 'Publish failed');
            } finally {
              setPublishing(false);
            }
          }}
        >
          <Upload className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish bundle'}
        </button>
      </div>
    </>
  );
}

function IngestPanel({
  pack,
  onIngested,
  onError,
}: {
  pack: HiddenPack;
  onIngested: (r: IngestResult) => void;
  onError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<'idle' | 'presign' | 'upload' | 'ingest'>('idle');
  const [result, setResult] = useState<IngestResult | null>(null);

  const busy = phase !== 'idle';

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
      <h3 className="font-semibold text-slate-200 flex items-center gap-2">
        <Upload className="w-4 h-4" /> Ingest a scene
      </h3>
      <p className="text-xs text-slate-500">
        Zip the artist folder exactly as delivered and upload it. The folder must contain one image whose name includes
        “without” (the clean plate) and the full-canvas “masked” layers. Reference art is skipped automatically. Re-uploading
        an existing scene slug replaces its art without breaking saved player progress.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className={inputCls} placeholder="scene slug (e.g. pirate_cabin)" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input className={inputCls} placeholder="Scene name" value={name} onChange={(e) => setName(e.target.value)} />
        <input ref={fileRef} type="file" accept=".zip,application/zip" className={`${inputCls} file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-200`} />
      </div>
      <div className="flex items-center gap-3">
        <button
          className={btnPrimary}
          disabled={busy || !slug.trim()}
          onClick={async () => {
            const file = fileRef.current?.files?.[0];
            if (!file) {
              onError('Choose the zipped artist folder first');
              return;
            }
            setResult(null);
            try {
              const r = await ingestSceneZip(pack.packId, slug.trim(), name.trim(), file, setPhase);
              setResult(r);
              onIngested(r);
            } catch (e) {
              onError(e instanceof Error ? e.message : 'Ingest failed');
            } finally {
              setPhase('idle');
            }
          }}
        >
          <Upload className="w-4 h-4" />
          {phase === 'idle' && 'Upload & ingest'}
          {phase === 'presign' && 'Preparing…'}
          {phase === 'upload' && 'Uploading zip…'}
          {phase === 'ingest' && 'Ingesting (composites, masks, icons)…'}
        </button>
      </div>

      {result && (
        <div className="space-y-2 pt-2 border-t border-slate-700">
          {result.warnings?.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-300 bg-amber-900/30 border border-amber-800 rounded-lg p-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{w} — check the inspector below before players meet this.</span>
            </div>
          ))}
          {result.retiredItems && result.retiredItems.length > 0 && (
            <div className="text-xs text-slate-400">Retired items (kept for saved progress): {result.retiredItems.join(', ')}</div>
          )}
          {result.skippedFiles && result.skippedFiles.length > 0 && (
            <div className="text-xs text-slate-500">Skipped: {result.skippedFiles.join(' · ')}</div>
          )}
        </div>
      )}
    </div>
  );
}

function SceneTable({
  pack,
  scenes,
  onChanged,
  onError,
}: {
  pack: HiddenPack;
  scenes: HiddenScene[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [inspecting, setInspecting] = useState<HiddenScene | null>(null);
  const [editing, setEditing] = useState<HiddenScene | null>(null);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40">
      <div className="p-4 border-b border-slate-700 font-semibold text-slate-200">Scenes</div>
      {scenes.length === 0 && <div className="p-4 text-sm text-slate-500">No scenes yet — ingest one above.</div>}
      <div className="divide-y divide-slate-700/60">
        {scenes.map((sc) => (
          <div key={sc.sceneId} className="p-3">
            <div className="flex items-center gap-3">
              {sc.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sc.thumbUrl} alt={sc.slug} className="w-14 h-14 object-cover rounded-lg border border-slate-700" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-slate-700" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-slate-100 text-sm font-medium truncate flex items-center gap-2">
                  {sc.name || sc.slug}
                  {!sc.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">HIDDEN</span>}
                  {sc.itemId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">PAID SCENE</span>}
                  {sc.isFree && pack.itemId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300">FREE SAMPLE</span>}
                  {sc.ingestWarnings && sc.ingestWarnings.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 inline-flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> {sc.ingestWarnings.length}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {sc.slug} · {sc.itemCount} items · {sc.imageWidth}×{sc.imageHeight} · {fmtBytes(sc.sizeBytes)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400" title="Inspect answer key" onClick={() => setInspecting(inspecting?.sceneId === sc.sceneId ? null : sc)}>
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400" title="Edit scene" onClick={() => setEditing(editing?.sceneId === sc.sceneId ? null : sc)}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400"
                  title={sc.isActive ? 'Hide scene' : 'Show scene'}
                  onClick={async () => {
                    try {
                      await adminSetSceneActive(sc.sceneId, !sc.isActive);
                      onChanged();
                    } catch (e) {
                      onError(e instanceof Error ? e.message : 'Failed');
                    }
                  }}
                >
                  <Power className={`w-4 h-4 ${sc.isActive ? 'text-emerald-400' : ''}`} />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-red-900/60 text-slate-400 hover:text-red-300"
                  title="Delete scene"
                  onClick={async () => {
                    if (!confirm(`Delete scene "${sc.name || sc.slug}" and its player sessions?`)) return;
                    try {
                      await adminDeleteScene(sc.sceneId);
                      onChanged();
                    } catch (e) {
                      onError(e instanceof Error ? e.message : 'Failed');
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {sc.ingestWarnings && sc.ingestWarnings.length > 0 && inspecting?.sceneId !== sc.sceneId && (
              <div className="mt-2 text-xs text-amber-400/80 pl-[68px]">{sc.ingestWarnings[0]}{sc.ingestWarnings.length > 1 ? ` (+${sc.ingestWarnings.length - 1} more)` : ''}</div>
            )}
            {editing?.sceneId === sc.sceneId && (
              <SceneEditor
                scene={sc}
                onDone={() => {
                  setEditing(null);
                  onChanged();
                }}
                onError={onError}
              />
            )}
            {inspecting?.sceneId === sc.sceneId && <SceneInspector scene={sc} onError={onError} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneEditor({
  scene,
  onDone,
  onError,
}: {
  scene: HiddenScene;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(scene.name);
  const [itemId, setItemId] = useState(scene.itemId ?? '');
  const [isFree, setIsFree] = useState(scene.isFree);
  const [sortOrder, setSortOrder] = useState(scene.sortOrder);
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Scene name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} type="number" placeholder="Sort order" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
      </div>
      <input
        className={inputCls}
        placeholder="Store item ID — set to sell THIS scene inside a free pack; empty = included"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
        <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        Free sample — playable even when the parent pack is paid and unowned
      </label>
      <div className="flex justify-end gap-2">
        <button
          className={btnPrimary}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await adminUpdateScene({ sceneId: scene.sceneId, name: name.trim(), itemId: itemId.trim() || undefined, isFree, sortOrder });
              onDone();
            } catch (e) {
              onError(e instanceof Error ? e.message : 'Failed to save scene');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Save className="w-4 h-4" /> Save scene
        </button>
      </div>
    </div>
  );
}

/**
 * The scene inspector: the composite with every item's bbox drawn over it —
 * the human check that the geometry landed on the right objects, and the
 * place to eyeball overlap warnings before a player pays a life for one.
 */
function SceneInspector({ scene, onError }: { scene: HiddenScene; onError: (msg: string) => void }) {
  const [items, setItems] = useState<HiddenItem[] | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    adminListSceneItems(scene.sceneId)
      .then(setItems)
      .catch((e) => onError(e instanceof Error ? e.message : 'Failed to load items'));
  }, [scene.sceneId, onError]);

  return (
    <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 relative rounded-lg overflow-hidden border border-slate-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scene.previewUrl || scene.imageUrl} alt={scene.slug} className="w-full block" />
        {items
          ?.filter((it) => it.isActive)
          .map((it) => (
            <div
              key={it.idx}
              className={`absolute border-2 rounded-sm transition-colors ${
                hover === it.idx ? 'border-emerald-400 bg-emerald-400/20' : 'border-amber-400/70'
              }`}
              style={{
                left: `${it.bboxX * 100}%`,
                top: `${it.bboxY * 100}%`,
                width: `${it.bboxW * 100}%`,
                height: `${it.bboxH * 100}%`,
              }}
              title={`${it.name} (idx ${it.idx})`}
            />
          ))}
      </div>
      <div className="space-y-1">
        {!items && <div className="text-sm text-slate-500">Loading answer key…</div>}
        {items?.map((it) => (
          <div
            key={it.idx}
            className={`flex items-center gap-2 p-1.5 rounded-lg text-sm ${
              hover === it.idx ? 'bg-slate-700/80' : 'bg-slate-800/40'
            } ${it.isActive ? 'text-slate-200' : 'text-slate-500 line-through'}`}
            onMouseEnter={() => setHover(it.idx)}
            onMouseLeave={() => setHover(null)}
          >
            {it.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.iconUrl} alt={it.slug} className="w-7 h-7 object-contain" />
            ) : (
              <div className="w-7 h-7 rounded bg-slate-700" />
            )}
            <span className="truncate flex-1">{it.name}</span>
            <span className="text-[10px] text-slate-500">idx {it.idx} · d{it.difficulty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ladder editor
// ---------------------------------------------------------------------------

function LadderEditor({
  pack,
  scenes,
  levels,
  onChanged,
  onError,
}: {
  pack: HiddenPack;
  scenes: HiddenScene[];
  levels: HiddenLevel[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, { sceneId: string; targetCount: number; timeLimitSec: number }>>({});
  const nextLevel = (levels[levels.length - 1]?.level ?? 0) + 1;
  const [adding, setAdding] = useState<{ level: number; sceneId: string; targetCount: number; timeLimitSec: number } | null>(null);

  const saveRow = async (level: number, sceneId: string, targetCount: number, timeLimitSec: number) => {
    try {
      await adminUpsertLevel({ packId: pack.packId, level, sceneId, targetCount, timeLimitSec });
      setDrafts((d) => {
        const { [level]: _, ...rest } = d;
        return rest;
      });
      setAdding(null);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save level');
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
          <ListOrdered className="w-4 h-4" /> Level ladder
        </h3>
        <button
          className={btnGhost}
          disabled={scenes.length === 0 || !!adding}
          onClick={() => setAdding({ level: nextLevel, sceneId: scenes[0]?.sceneId ?? '', targetCount: 6, timeLimitSec: 0 })}
        >
          <Plus className="w-4 h-4" /> Add level {nextLevel}
        </button>
      </div>
      <p className="px-4 pt-3 text-xs text-slate-500">
        Editing a level’s scene or target count redefines that slot’s hunt for every player. Time limit 0 = untimed.
      </p>
      <div className="p-4 space-y-2">
        {levels.length === 0 && !adding && <div className="text-sm text-slate-500">No levels yet — the pack is unplayable until it has a ladder.</div>}
        {levels.map((lv) => {
          const d = drafts[lv.level] ?? { sceneId: lv.sceneId, targetCount: lv.targetCount, timeLimitSec: lv.timeLimitSec };
          const dirty = d.sceneId !== lv.sceneId || d.targetCount !== lv.targetCount || d.timeLimitSec !== lv.timeLimitSec;
          return (
            <div key={lv.level} className="grid grid-cols-[3rem_1fr_7rem_7rem_auto] gap-2 items-center">
              <div className="text-slate-300 text-sm font-mono text-center">{lv.level}</div>
              <select
                className={inputCls}
                value={d.sceneId}
                onChange={(e) => setDrafts((x) => ({ ...x, [lv.level]: { ...d, sceneId: e.target.value } }))}
              >
                {scenes.map((sc) => (
                  <option key={sc.sceneId} value={sc.sceneId}>
                    {sc.name || sc.slug}
                  </option>
                ))}
              </select>
              <input
                className={inputCls}
                type="number"
                min={1}
                title="Targets"
                value={d.targetCount}
                onChange={(e) => setDrafts((x) => ({ ...x, [lv.level]: { ...d, targetCount: Number(e.target.value) || 1 } }))}
              />
              <input
                className={inputCls}
                type="number"
                min={0}
                title="Time limit (seconds, 0 = untimed)"
                value={d.timeLimitSec}
                onChange={(e) => setDrafts((x) => ({ ...x, [lv.level]: { ...d, timeLimitSec: Number(e.target.value) || 0 } }))}
              />
              <div className="flex gap-1">
                <button
                  className={`p-1.5 rounded ${dirty ? 'text-emerald-400 hover:bg-slate-700' : 'text-slate-600'}`}
                  disabled={!dirty}
                  title="Save level"
                  onClick={() => void saveRow(lv.level, d.sceneId, d.targetCount, d.timeLimitSec)}
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-red-900/60 text-slate-400 hover:text-red-300"
                  title="Delete level"
                  onClick={async () => {
                    if (!confirm(`Delete level ${lv.level}? Later levels keep their numbers.`)) return;
                    try {
                      await adminDeleteLevel(pack.packId, lv.level);
                      onChanged();
                    } catch (e) {
                      onError(e instanceof Error ? e.message : 'Failed');
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {adding && (
          <div className="grid grid-cols-[3rem_1fr_7rem_7rem_auto] gap-2 items-center pt-2 border-t border-slate-700">
            <div className="text-slate-300 text-sm font-mono text-center">{adding.level}</div>
            <select className={inputCls} value={adding.sceneId} onChange={(e) => setAdding({ ...adding, sceneId: e.target.value })}>
              {scenes.map((sc) => (
                <option key={sc.sceneId} value={sc.sceneId}>
                  {sc.name || sc.slug}
                </option>
              ))}
            </select>
            <input className={inputCls} type="number" min={1} value={adding.targetCount} onChange={(e) => setAdding({ ...adding, targetCount: Number(e.target.value) || 1 })} />
            <input className={inputCls} type="number" min={0} value={adding.timeLimitSec} onChange={(e) => setAdding({ ...adding, timeLimitSec: Number(e.target.value) || 0 })} />
            <div className="flex gap-1">
              <button className="p-1.5 rounded text-emerald-400 hover:bg-slate-700" title="Add level" onClick={() => void saveRow(adding.level, adding.sceneId, adding.targetCount, adding.timeLimitSec)}>
                <Save className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded text-slate-400 hover:bg-slate-700" title="Cancel" onClick={() => setAdding(null)}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
