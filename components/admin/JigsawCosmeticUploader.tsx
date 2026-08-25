'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Upload } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// Jigsaw cosmetic uploader — board surfaces and piece shapes.
//
// Both are ordinary `game_upgrade` store items tagged to the jigsaw game, so
// pricing, bundles, deals and the shop work with no jigsaw-specific handling.
// The jigsaw-specific part is entirely in two fields:
//
//   option_id           → becomes the id written onto jigsaw_sessions.
//                         background_id / shape_id when a player picks it. This
//                         is the durable identity: a live board names it, so it
//                         must stay short, stable and never be re-pointed.
//   metadata.textureUrl → the surface image the board renders (boards only).
//   metadata.swatch     → the flat colour drawn under it.
//
// Read back by CatalogService.cosmetics() in services/jigsaw/catalog.go, which
// resolves the id as COALESCE(NULLIF(option_id,''), slug) — so option_id is
// what keeps the id "slate" rather than "jigsaw_board_slate".
//
// Subcategory strings must match the Go constants cosmeticTypeShape /
// cosmeticTypeBackground; they are what maps an item to its picker.

type Mode = 'board' | 'piece_shape';

const MODE_LABEL: Record<Mode, string> = {
  board: 'Boards',
  piece_shape: 'Shapes',
};

/**
 * Ids the server ships compiled-in as free defaults.
 *
 * An uploaded item reusing one of these is DROPPED by cosmetics() — the
 * built-in wins, because live sessions already reference it. That is a silent
 * no-op rather than an error, so the collision has to be caught here or the
 * admin uploads art that simply never appears.
 *
 * Flat across BOTH types, not one list per type, and that is not sloppiness:
 * cosmetics() seeds ONE `seen` map from the shapes and the backgrounds together
 * and skips any row whose id is already in it. So a board called `classic`
 * collides with the built-in SHAPE of that name and is dropped just the same.
 * Ids are unique per game, not per picker.
 */
const BUILT_IN_IDS = ['oak', 'walnut', 'classic', 'square'];

interface UploadEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  publicUrl?: string;
  error?: string;
  previewObjectUrl?: string;
  /** The durable cosmetic id. Editable — it outlives the filename. */
  optionId: string;
  name: string;
  /** Average colour of the image, hex. Boards only; prefilled, editable. */
  swatch: string;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function extOf(name: string): string {
  return name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
}

function contentTypeFor(file: File): string {
  return CONTENT_TYPE_BY_EXT[extOf(file.name)] ?? 'image/webp';
}

function stemOf(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function titleize(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Mean colour of an image as a hex string, for the swatch default.
 *
 * Computed rather than asked for because the swatch is the field an admin
 * forgets — it has no fallback server-side, and without it the board paints
 * white until the texture downloads. A mean is deliberately crude: this is the
 * colour the board sits at for a few hundred milliseconds, not a brand value,
 * and the field stays editable.
 *
 * Transparent pixels are skipped so a shape silhouette does not average toward
 * whatever the canvas was cleared to.
 */
async function meanColorHex(file: File): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, size, size);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    if (n === 0) return undefined;
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
  } catch {
    return undefined;
  }
}

function revokePreviews(list: UploadEntry[]) {
  for (const e of list) {
    if (e.previewObjectUrl) URL.revokeObjectURL(e.previewObjectUrl);
  }
}

/**
 * Presign one object and PUT it straight to R2 from the browser.
 *
 * itemType `game_item` keys as games/{category}/items/{subcategory}/{uuid}{ext},
 * which for (jigsaw, board) is games/jigsaw/items/board/… — no jigsaw-specific
 * presign mode needed. UUID-keyed, so a re-upload lands at a new object rather
 * than overwriting one a CDN is already serving.
 */
async function presignAndPut(mode: Mode, file: File): Promise<string> {
  const ct = contentTypeFor(file);
  const raw = await callAdminRpc(
    'store/admin_get_upload_url',
    JSON.stringify({
      itemType: 'game_item',
      category: 'jigsaw',
      subcategory: mode,
      fileName: '',
      contentType: ct,
    }),
  );
  const data = unwrapAdminRpcData<{ uploadUrl: string; publicUrl: string }>(raw);
  if (!data?.uploadUrl || !data?.publicUrl) throw new Error('Bad presign response');
  const res = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': ct }, body: file });
  if (!res.ok) throw new Error(`R2 PUT failed: ${res.status}`);
  return data.publicUrl;
}

const inputCls = 'px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-xs';

export default function JigsawCosmeticUploader({
  existingIds,
  onUploaded,
}: {
  /** option_ids already published, so a collision is caught before upload. */
  existingIds: string[];
  onUploaded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('board');
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [priceCoins, setPriceCoins] = useState(500);
  const [priceGems, setPriceGems] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const liveEntries = useRef<UploadEntry[]>([]);
  useEffect(() => { liveEntries.current = entries; }, [entries]);
  useEffect(() => () => revokePreviews(liveEntries.current), []);

  const reset = () => {
    revokePreviews(entries);
    setEntries([]);
    setCreatedCount(null);
    setError('');
  };

  async function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;
    const picked = Array.from(files);
    const images = picked.filter((f) => extOf(f.name) in CONTENT_TYPE_BY_EXT);

    revokePreviews(entries);
    const taken = new Set<string>();
    const next: UploadEntry[] = images.map((file) => {
      const stem = stemOf(file.name);
      let id = slugify(stem);
      // Same-name files in one drop would otherwise write two items onto one
      // option_id, and the second would win silently.
      while (taken.has(id)) id = `${id}_2`;
      taken.add(id);
      return {
        file,
        status: 'pending' as const,
        optionId: id,
        name: titleize(stem),
        swatch: '#000000',
        previewObjectUrl: URL.createObjectURL(file),
      };
    });
    setEntries(next);
    setCreatedCount(null);
    setError(
      images.length < picked.length
        ? `Ignored ${picked.length - images.length} non-image file(s) — WebP, PNG or JPEG only.`
        : '',
    );

    // Prefill each swatch from the art itself, one at a time so a folder drop
    // does not decode forty bitmaps at once.
    for (let i = 0; i < next.length; i++) {
      const hex = await meanColorHex(next[i].file);
      if (!hex) continue;
      setEntries((cur) => cur.map((e, n) => (n === i ? { ...e, swatch: hex } : e)));
    }
  }

  const patch = (i: number, p: Partial<UploadEntry>) =>
    setEntries((cur) => cur.map((e, n) => (n === i ? { ...e, ...p } : e)));

  const collisionFor = (entry: UploadEntry): string => {
    const id = slugify(entry.optionId);
    if (!id) return 'an id is required';
    if (BUILT_IN_IDS.includes(id)) return `"${id}" is a built-in — the upload would be silently ignored`;
    if (existingIds.includes(id)) return `"${id}" already exists — it will be replaced`;
    return '';
  };

  async function submit() {
    if (entries.length === 0) { setError('Drop at least one image.'); return; }
    const blocking = entries.find((e) => {
      const id = slugify(e.optionId);
      return !id || BUILT_IN_IDS.includes(id);
    });
    if (blocking) {
      setError('Fix the highlighted ids first — a built-in id is silently ignored by the server.');
      return;
    }
    if (priceCoins <= 0 && priceGems <= 0) {
      setError('Set a price in coins or gems. A cosmetic at zero is bought for nothing, not given away — leave it unpublished instead.');
      return;
    }
    if (priceCoins > 0 && priceGems > 0) {
      setError('Exactly one currency per item — clear either coins or gems.');
      return;
    }

    setUploading(true);
    setError('');
    setCreatedCount(null);
    const next = entries.map((e) => ({ ...e }));
    let created = 0;

    // Sequential: each file is one presign + one PUT + one item write, and a
    // folder drop in parallel would open every socket at once and starve the
    // presign calls that gate the uploads.
    for (let i = 0; i < next.length; i++) {
      const entry = next[i];
      entry.status = 'uploading';
      setEntries([...next]);
      try {
        const publicUrl = await presignAndPut(mode, entry.file);
        const id = slugify(entry.optionId);
        const name = entry.name.trim() || titleize(id);
        await callAdminRpc('store/admin_add_item', JSON.stringify({
          itemId: crypto.randomUUID(),
          // Upserts on slug, so re-uploading art for the same cosmetic
          // repoints the existing row instead of dying on UNIQUE(slug).
          slug: `jigsaw_${mode}_${id}`,
          name,
          description: `${name} ${mode === 'board' ? 'board' : 'piece shape'} for Jigsaw`,
          previewUrl: publicUrl,
          upgradeType: 'game_upgrade',
          category: 'jigsaw',
          gameId: 'jigsaw',
          subcategory: mode,
          type: mode,
          // The durable id. cosmetics() reads COALESCE(NULLIF(option_id,''),
          // slug), so without this the player-facing id would be the long slug.
          optionId: id,
          price: { coins: priceCoins, gems: priceGems },
          isActive: true,
          stock: -1,
          metadata: mode === 'board'
            // textureUrl is what the board renders; it COALESCEs to preview_url
            // server-side, but setting it explicitly leaves the shop thumbnail
            // free to diverge from the full-res surface later.
            ? { purchaseLimit: '1', textureUrl: publicUrl, swatch: entry.swatch }
            : { purchaseLimit: '1' },
        }));
        entry.publicUrl = publicUrl;
        entry.status = 'done';
        created++;
      } catch (e) {
        // One bad file does not abort the batch — the ones that worked are real
        // store items and keeping them beats rolling back a whole folder.
        entry.status = 'error';
        entry.error = e instanceof Error ? e.message : 'upload failed';
      }
      setEntries([...next]);
    }

    setUploading(false);
    setCreatedCount(created);
    if (created === 0) setError('Nothing was created — check the row errors above.');
    else onUploaded?.();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add boards or shapes
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Add jigsaw cosmetics</h3>
        <button onClick={() => { reset(); setOpen(false); }} className="text-xs text-slate-400 hover:text-slate-100">
          Close
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(['board', 'piece_shape'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); reset(); }}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-2">Coins</span>
        <input type="number" min={0} value={priceCoins}
          onChange={(e) => setPriceCoins(parseInt(e.target.value, 10) || 0)}
          className={`${inputCls} w-24`} />
        <span className="text-xs text-slate-400">Gems</span>
        <input type="number" min={0} value={priceGems}
          onChange={(e) => setPriceGems(parseInt(e.target.value, 10) || 0)}
          className={`${inputCls} w-24`} />
      </div>

      <p className="text-xs text-slate-400">
        {mode === 'board' ? (
          <>
            One image per board surface — <strong>each file becomes a purchasable board</strong>. The image is
            stored as <code>metadata.textureUrl</code> (what the board renders) and doubles as the shop
            thumbnail. The <strong>swatch</strong> is the flat colour painted underneath while that image
            downloads; it is read from the art automatically and stays editable. There is no server-side
            fallback for it, so a board without one flashes white on a slow connection.
          </>
        ) : (
          <>
            One image per piece shape — a silhouette of the cut, shown in the settings sheet picker. Shapes
            carry no texture and no swatch: the shape itself is drawn by the client from the cut algorithm,
            and this image only has to make the option recognisable.
          </>
        )}
      </p>

      <div
        className={`rounded-lg border-2 border-dashed p-4 text-center ${
          uploading ? 'border-slate-700 opacity-60' : 'border-slate-600 cursor-pointer hover:border-slate-500'
        }`}
        onClick={() => { if (!uploading) inputRef.current?.click(); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void onFilesPicked(e.dataTransfer.files); }}
      >
        <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
        <p className="text-xs text-slate-300">Drop {MODE_LABEL[mode].toLowerCase()} art — WebP / PNG / JPEG</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Click or drop — multiple files supported</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/webp,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />
      </div>

      {entries.length > 0 && (
        <div className="rounded-lg bg-slate-900 border border-slate-700 max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 sticky top-0 bg-slate-900">
              <tr>
                <th className="px-2 py-1 text-left w-10" />
                <th className="px-2 py-1 text-left">Name</th>
                <th className="px-2 py-1 text-left" title="Written onto the session when a player picks this. Keep it short and never change it once live.">
                  Cosmetic id
                </th>
                {mode === 'board' && <th className="px-2 py-1 text-left">Swatch</th>}
                <th className="px-2 py-1 text-left">File</th>
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const clash = collisionFor(e);
                const blocking = clash.includes('built-in') || clash.includes('required');
                return (
                  <tr key={i} className="border-t border-slate-700/50">
                    <td className="px-2 py-1">
                      {e.previewObjectUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.previewObjectUrl} alt={e.name}
                          className="w-8 h-8 rounded object-cover border border-slate-700" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700" />
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <input value={e.name} onChange={(ev) => patch(i, { name: ev.target.value })}
                        disabled={uploading} className={`${inputCls} w-32`} />
                    </td>
                    <td className="px-2 py-1">
                      <input value={e.optionId} onChange={(ev) => patch(i, { optionId: ev.target.value })}
                        disabled={uploading}
                        className={`${inputCls} w-28 font-mono ${blocking ? 'border-red-500' : ''}`} />
                      {clash && (
                        <p className={`text-[10px] mt-0.5 ${blocking ? 'text-red-400' : 'text-amber-400'}`}>{clash}</p>
                      )}
                    </td>
                    {mode === 'board' && (
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <input type="color" value={e.swatch} disabled={uploading}
                            onChange={(ev) => patch(i, { swatch: ev.target.value.toUpperCase() })}
                            className="w-6 h-6 rounded border border-slate-600 bg-slate-900" />
                          <input value={e.swatch} disabled={uploading}
                            onChange={(ev) => patch(i, { swatch: ev.target.value.toUpperCase() })}
                            className={`${inputCls} w-20 font-mono`} />
                        </div>
                      </td>
                    )}
                    <td className="px-2 py-1 text-slate-400">
                      {e.file.name} · {prettyBytes(e.file.size)}
                    </td>
                    <td className="px-2 py-1">
                      {e.status === 'done' && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> created
                        </span>
                      )}
                      {e.status === 'error' && (
                        <span className="text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {e.error ?? 'error'}
                        </span>
                      )}
                      {e.status === 'uploading' && <span className="text-amber-400">uploading…</span>}
                      {e.status === 'pending' && <span className="text-slate-500">pending</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
      {createdCount !== null && createdCount > 0 && (
        <p className="text-xs text-emerald-400">
          Created {createdCount} item(s). The {MODE_LABEL[mode]} sub-tab appears in the app automatically —
          game sub-tabs are derived from the distinct item types a game has.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={uploading || entries.length === 0}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : `Upload ${entries.length || ''} ${MODE_LABEL[mode].toLowerCase()}`}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={uploading}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
