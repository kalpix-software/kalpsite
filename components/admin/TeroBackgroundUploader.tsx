'use client';

import { useState, useRef } from 'react';
import { Plus, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// Tero table-background uploader — one purchasable store item per background.
//
// A background is an ordinary `game_upgrade` store_item tagged to tero, so
// pricing, bundles, deals and the player-facing shop need no special handling.
// The tero-specific contract is the metadata, read by GetEquippedBackgroundAsset
// in services/game/preferences.go:
//   metadata.assetUrl  → the full-res video or image rendered on the table
//   metadata.mediaType → "video" or "image"; anything not "video" is treated as
//                        an image, so an mp4 with this unset renders as a
//                        broken still rather than playing
//   preview_url        → the shop tile, and for video the poster plak shows
//                        while the file buffers
//
// The generic "Upload Tero variant" flow on /admin/store sets preview_url but
// NOT metadata.assetUrl, which produces a background with no background — it
// renders nothing in-match. Everything created here always sets both.
//
// MULTI-FILE. Drop any number of backgrounds and each becomes its own item.
// Videos are paired with their poster by filename stem, so space.mp4 pairs with
// space_poster.webp or space.webp. That pairing is why the poster cannot simply
// be a second picker once more than one video is in flight.

type Mode = 'video' | 'image';

interface Group {
  stem: string;
  asset: File;
  poster?: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  assetUrl?: string;
  posterUrl?: string;
  hasAudio?: boolean;
}

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function contentTypeFor(file: File): string {
  const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
  if (ext === '.mp4') return 'video/mp4';
  return IMAGE_CONTENT_TYPES[ext] ?? 'image/webp';
}

const isVideoFile = (f: File) => contentTypeFor(f) === 'video/mp4';

/** "space_poster.webp" and "space.mp4" both reduce to "space". */
function stemOf(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]?poster$/i, '');
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function titleize(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Best-effort check for an audio track.
 *
 * Backgrounds loop muted behind the table, but a muted track can still take OS
 * audio focus and interrupt the player's own music, so the asset should carry
 * no audio at all. Browsers expose this only through vendor-prefixed hints, so
 * a false "no audio" is possible — hence a warning, never a block.
 */
async function probeAudioTrack(file: File): Promise<boolean | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (v: boolean | undefined) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      const v = el as HTMLVideoElement & {
        mozHasAudio?: boolean;
        webkitAudioDecodedByteCount?: number;
        audioTracks?: { length: number };
      };
      if (typeof v.mozHasAudio === 'boolean') return done(v.mozHasAudio);
      if (v.audioTracks) return done(v.audioTracks.length > 0);
      if (typeof v.webkitAudioDecodedByteCount === 'number') {
        return done(v.webkitAudioDecodedByteCount > 0 ? true : undefined);
      }
      done(undefined);
    };
    el.onerror = () => done(undefined);
    el.src = url;
  });
}

export default function TeroBackgroundUploader({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('video');
  const [variant, setVariant] = useState('');
  const [priceCoins, setPriceCoins] = useState(500);
  const [priceGems, setPriceGems] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [uploading, setUploading] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const variantSlug = slugify(variant);

  const reset = () => {
    setVariant('');
    setPriceCoins(500);
    setPriceGems(0);
    setGroups([]);
    setCreatedCount(null);
    setError('');
  };

  async function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    setCreatedCount(null);

    const picked = Array.from(files);
    const assets = picked.filter((f) => (mode === 'video' ? isVideoFile(f) : !isVideoFile(f)));
    // In video mode every still is a poster candidate. In image mode a file is
    // its own poster, so nothing is set aside.
    const posters = mode === 'video' ? picked.filter((f) => !isVideoFile(f)) : [];

    if (assets.length === 0) {
      setError(
        mode === 'video'
          ? 'No .mp4 found. Video backgrounds must be H.264 MP4 — switch to Image for stills.'
          : 'No image found. Switch to Video to upload .mp4 backgrounds.',
      );
      return;
    }

    const next: Group[] = assets.map((asset) => {
      const stem = stemOf(asset.name);
      return {
        stem,
        asset,
        poster: posters.find((p) => stemOf(p.name) === stem),
        status: 'pending' as const,
      };
    });
    setGroups(next);

    if (mode === 'video') {
      const probed = await Promise.all(
        next.map(async (g) => ({ ...g, hasAudio: await probeAudioTrack(g.asset) })),
      );
      setGroups(probed);
    }
  }

  async function uploadOne(file: File): Promise<string> {
    const ct = contentTypeFor(file);
    const raw = await callAdminRpc(
      'store/admin_get_upload_url',
      JSON.stringify({
        // Same presign mode chess and the card decks use. It keys uploads as
        // games/{category}/{subcategory}/{variant}/{fileName}, which here is
        // exactly games/tero/background/<variant>/<file>.
        itemType: 'game_deck_asset',
        category: 'tero',
        subcategory: 'background',
        variant: variantSlug,
        fileName: file.name,
        contentType: ct,
      }),
    );
    const data = unwrapAdminRpcData<{ uploadUrl: string; publicUrl: string }>(raw);
    if (!data?.uploadUrl || !data?.publicUrl) throw new Error('Bad presign response');
    const res = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': ct }, body: file });
    if (!res.ok) throw new Error(`R2 PUT failed: ${res.status}`);
    return data.publicUrl;
  }

  const missingPosters = mode === 'video' ? groups.filter((g) => !g.poster) : [];

  async function submit() {
    if (!variantSlug) {
      setError('Variant slug is required (e.g. space, neon, aurora). It is the R2 folder these land in.');
      return;
    }
    if (groups.length === 0) {
      setError('Drop at least one background file.');
      return;
    }
    // A video with no poster shows nothing until the first frame decodes, and
    // preview_url is both the shop tile and that poster.
    if (missingPosters.length > 0) {
      setError(
        `No poster for: ${missingPosters.map((g) => g.stem).join(', ')}. ` +
          'Add a still named after the video (space.mp4 → space_poster.webp or space.webp).',
      );
      return;
    }

    setUploading(true);
    setError('');
    setCreatedCount(null);

    const next = groups.map((g) => ({ ...g }));
    let created = 0;

    for (let i = 0; i < next.length; i++) {
      const g = next[i];
      g.status = 'uploading';
      setGroups([...next]);
      try {
        g.assetUrl = await uploadOne(g.asset);
        // An image with no separate poster is its own shop tile.
        g.posterUrl = g.poster ? await uploadOne(g.poster) : g.assetUrl;

        const name = titleize(g.stem);
        await callAdminRpc(
          'store/admin_add_item',
          JSON.stringify({
            itemId: crypto.randomUUID(),
            slug: `tero_background_${variantSlug}_${slugify(g.stem)}`,
            name,
            description: `${name} table background for Tero`,
            previewUrl: g.posterUrl,
            upgradeType: 'game_upgrade',
            category: 'tero',
            gameId: 'tero',
            subcategory: 'background',
            type: 'background',
            price: { coins: priceCoins, gems: priceGems },
            isActive: true,
            stock: -1,
            metadata: {
              purchaseLimit: '1',
              variant: variantSlug,
              assetUrl: g.assetUrl,
              mediaType: mode,
            },
          }),
        );
        g.status = 'done';
        created++;
      } catch (e) {
        g.status = 'error';
        g.error = e instanceof Error ? e.message : 'Failed';
      }
      setGroups([...next]);
    }

    setCreatedCount(created);
    if (created < next.length) {
      setError(`${next.length - created} of ${next.length} failed — see the rows above. The rest were created.`);
    }
    if (created > 0) onUploaded?.();
    setUploading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
      >
        <Plus className="w-4 h-4" /> Upload table backgrounds
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Upload Tero table backgrounds</h3>
        <button onClick={() => { reset(); setOpen(false); }} className="text-xs text-slate-400 hover:text-slate-100">Close</button>
      </div>

      <p className="text-xs text-slate-400">
        Drop as many as you like — <strong>each file becomes its own purchasable item</strong>.
        Backgrounds are <strong>per-viewer</strong>: only the owner sees their own.
        {mode === 'video' ? (
          <> Video must be <strong>H.264 MP4</strong> with <strong>no audio track</strong>, and each
          one needs a poster named after it (<code>space.mp4</code> → <code>space_poster.webp</code>)
          — the poster is the shop tile and the still shown while the video buffers.</>
        ) : (
          <> Each image is both the table surface and its own shop tile.</>
        )}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <select
            value={mode}
            onChange={(e) => { setMode(e.target.value as Mode); setGroups([]); setError(''); setCreatedCount(null); }}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          >
            <option value="video">Video (mp4)</option>
            <option value="image">Image (webp/png/jpeg)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Variant slug <span className="text-slate-500">(R2 folder)</span>
          </label>
          <input
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="space, neon, aurora…"
            title="Groups these files in R2 under games/tero/background/<slug>/. Item names come from each filename."
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Coins (each)</label>
          <input
            type="number"
            value={priceCoins}
            onChange={(e) => setPriceCoins(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Gems (each)</label>
          <input
            type="number"
            value={priceGems}
            onChange={(e) => setPriceGems(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
        </div>
      </div>

      <div
        className="rounded-lg border-2 border-dashed border-slate-600 p-4 text-center cursor-pointer hover:border-slate-500"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void onFilesPicked(e.dataTransfer.files); }}
      >
        <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
        <p className="text-xs text-slate-300">
          {mode === 'video' ? 'Drop .mp4 files and their posters together' : 'Drop image files'}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">Click or drop — multiple files supported</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={mode === 'video' ? 'video/mp4,image/webp,image/png,image/jpeg' : 'image/webp,image/png,image/jpeg'}
          className="hidden"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />
      </div>

      {groups.length > 0 && (
        <div className="rounded-lg bg-slate-900 border border-slate-700 max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 sticky top-0 bg-slate-900">
              <tr>
                <th className="px-2 py-1 text-left">Item name</th>
                <th className="px-2 py-1 text-left">Background</th>
                {mode === 'video' && <th className="px-2 py-1 text-left">Poster</th>}
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={i} className="border-t border-slate-700/50">
                  <td className="px-2 py-1 text-slate-200">{titleize(g.stem)}</td>
                  <td className="px-2 py-1 text-slate-400">
                    {g.asset.name} · {prettyBytes(g.asset.size)}
                    {g.hasAudio === true && <span className="ml-1 text-amber-400" title="Re-encode with -an">has audio</span>}
                    {mode === 'video' && g.asset.size > 2 * 1024 * 1024 && (
                      <span className="ml-1 text-amber-400" title="Streams behind every match on mobile data">large</span>
                    )}
                  </td>
                  {mode === 'video' && (
                    <td className="px-2 py-1 text-slate-400">
                      {g.poster ? g.poster.name : <span className="text-red-400">missing</span>}
                    </td>
                  )}
                  <td className="px-2 py-1">
                    {g.status === 'done' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> created</span>}
                    {g.status === 'error' && <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {g.error}</span>}
                    {g.status === 'uploading' && <span className="text-amber-400">uploading…</span>}
                    {g.status === 'pending' && <span className="text-slate-500">pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {missingPosters.length > 0 && (
        <p className="text-xs text-amber-300 p-3 rounded-lg bg-amber-900/30 border border-amber-700">
          {missingPosters.length} video(s) have no poster. Name the still after the video —{' '}
          <code>space.mp4</code> pairs with <code>space_poster.webp</code> or <code>space.webp</code>.
        </p>
      )}

      {groups.some((g) => g.hasAudio === true) && (
        <p className="text-xs text-amber-300 p-3 rounded-lg bg-amber-900/30 border border-amber-700">
          One or more mp4s carry an <strong>audio track</strong>. Playback is muted, but the track can
          still grab OS audio focus and stop the player&rsquo;s music. Re-encode with <code>-an</code>.
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {createdCount !== null && createdCount > 0 && (
        <p className="text-xs text-emerald-200 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700">
          Created {createdCount} item{createdCount > 1 ? 's' : ''}. Players can buy and equip them; nothing
          is applied to anyone automatically.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => void submit()}
          disabled={uploading || groups.length === 0}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : `Upload ${groups.length || ''} background${groups.length === 1 ? '' : 's'} + create items`}
        </button>
        <button
          onClick={() => reset()}
          disabled={uploading}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm hover:bg-slate-600 disabled:opacity-50"
        >Reset</button>
      </div>
    </div>
  );
}
