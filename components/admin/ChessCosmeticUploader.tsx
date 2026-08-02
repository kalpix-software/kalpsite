'use client';

import { useState, useRef } from 'react';
import { Plus, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';
import { CHESS_PIECE_NAMES } from '@/lib/kalpix-web-sdk/chess';

// Chess cosmetic uploader — boards, piece sets and backgrounds.
//
// Reuses the existing `game_deck_asset` presign mode rather than adding a
// chess-specific one: it already keys uploads as
// games/{category}/{subcategory}/{variant}/{fileName}, which for
// (chess, pieces, walnut, wK.webp) is exactly games/chess/pieces/walnut/wK.webp
// — the layout the backend's metadata.baseUrl contract expects.
//
// Two upload models, mirroring DeckVariantUploader:
//   pieces          → one FOLDER of 12 sprites becomes ONE store_item.
//                     metadata.baseUrl points at the folder and the renderer
//                     appends the FEN letter it is already drawing.
//   board/background → ONE store_item PER FILE. Each is independently
//                     purchasable and equippable; variant is a grouping tag.
//
// Subcategory strings must match the Go constants in
// services/game/preferences.go (CosmeticBoard / CosmeticPieceSet /
// CosmeticBackground) — they are what maps an item to its equip slot.

type Mode = 'pieces' | 'board' | 'background';

interface UploadEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  publicUrl?: string;
  error?: string;
  /** Mean luminance of non-transparent pixels, 0–255. Undefined until measured. */
  luminance?: number;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function contentTypeFor(file: File): string {
  const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
  return CONTENT_TYPE_BY_EXT[ext] ?? 'image/webp';
}

/** "wK.webp" → "wK". Case is preserved: the twelve names are case-sensitive. */
function stemOf(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Mean luminance of every non-transparent pixel, used to sanity-check that a
 * set's w* sprites really are the light ones and b* the dark ones.
 *
 * This invariant is what makes per-side piece sets safe: in a match you only
 * ever see one set's white half against another set's black half, so if a set
 * ships dark "white" pieces the board becomes unreadable for BOTH players —
 * and the person who suffers didn't buy it. Warn, don't block: a deliberately
 * stylised set (shadow, glass) may legitimately invert.
 */
async function meanLuminance(file: File): Promise<number | undefined> {
  try {
    const bitmap = await createImageBitmap(file);
    // Downscale hard — we want a colour statistic, not fidelity.
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, size, size);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, size, size);
    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue; // skip transparent + soft edges
      total += (data[i] + data[i + 1] + data[i + 2]) / 3;
      count++;
    }
    return count > 0 ? total / count : undefined;
  } catch {
    return undefined;
  }
}

export default function ChessCosmeticUploader({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('pieces');
  const [variant, setVariant] = useState('walnut');
  const [priceCoins, setPriceCoins] = useState(500);
  const [priceGems, setPriceGems] = useState(0);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [createdItems, setCreatedItems] = useState<Array<{ name: string; previewUrl: string }> | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setVariant('walnut');
    setPriceCoins(500);
    setPriceGems(0);
    setEntries([]);
    setCreatedItems(null);
    setError('');
  };

  const onFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const allowed = Object.values(CONTENT_TYPE_BY_EXT);
    const accepted: UploadEntry[] = [];
    for (const f of Array.from(files)) {
      if (!allowed.includes(contentTypeFor(f))) continue;
      accepted.push({ file: f, status: 'pending' });
    }
    setEntries(accepted);
    setCreatedItems(null);
    setError('');

    // Measure luminance for piece sets so the contrast warning can render.
    if (mode === 'pieces') {
      const measured = await Promise.all(
        accepted.map(async (e) => ({ ...e, luminance: await meanLuminance(e.file) })),
      );
      setEntries(measured);
    }
  };

  const presentNames = new Set(entries.map((e) => stemOf(e.file.name)));
  const missingPieces = mode === 'pieces'
    ? CHESS_PIECE_NAMES.filter((n) => !presentNames.has(n))
    : [];
  const extraPieces = mode === 'pieces'
    ? entries.map((e) => stemOf(e.file.name)).filter((n) => !CHESS_PIECE_NAMES.includes(n as never))
    : [];

  // Contrast check: every w* should be lighter than every b*.
  const contrastWarnings = (() => {
    if (mode !== 'pieces') return [] as string[];
    const out: string[] = [];
    for (const e of entries) {
      const stem = stemOf(e.file.name);
      if (e.luminance === undefined) continue;
      if (stem.startsWith('w') && e.luminance < 110) {
        out.push(`${stem} is dark (${Math.round(e.luminance)}) but is a WHITE piece`);
      }
      if (stem.startsWith('b') && e.luminance > 145) {
        out.push(`${stem} is light (${Math.round(e.luminance)}) but is a BLACK piece`);
      }
    }
    return out;
  })();

  async function uploadAll() {
    if (!variant.trim()) {
      setError('Variant name is required (e.g. walnut, marble, neon).');
      return;
    }
    if (entries.length === 0) {
      setError('Drop at least one file before uploading.');
      return;
    }
    // A piece set with a hole renders a board with an invisible piece, so
    // unlike card decks (59 faces, partial iteration is plausible) an
    // incomplete chess set is a hard stop.
    if (mode === 'pieces' && missingPieces.length > 0) {
      setError(`Piece sets must include all 12 sprites. Missing: ${missingPieces.join(', ')}`);
      return;
    }
    if (mode === 'pieces' && extraPieces.length > 0) {
      setError(`Unrecognised file(s): ${extraPieces.join(', ')}. Names must be exactly wK, wQ, wR, wB, wN, wP, bK, bQ, bR, bB, bN, bP.`);
      return;
    }

    setUploading(true);
    setError('');
    setCreatedItems(null);

    const variantSlug = variant.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const next = entries.map((e) => ({ ...e }));

    for (let i = 0; i < next.length; i++) {
      const entry = next[i];
      entry.status = 'uploading';
      setEntries([...next]);

      try {
        const ct = contentTypeFor(entry.file);
        const raw = await callAdminRpc(
          'store/admin_get_upload_url',
          JSON.stringify({
            itemType: 'game_deck_asset',
            category: 'chess',
            subcategory: mode,
            variant: variantSlug,
            fileName: entry.file.name,
            contentType: ct,
          }),
        );
        const data = unwrapAdminRpcData<{ uploadUrl: string; publicUrl: string }>(raw);
        if (!data?.uploadUrl || !data?.publicUrl) throw new Error('Bad presign response');

        const putRes = await fetch(data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': ct },
          body: entry.file,
        });
        if (!putRes.ok) throw new Error(`R2 PUT failed: ${putRes.status}`);

        entry.status = 'done';
        entry.publicUrl = data.publicUrl;
      } catch (e) {
        entry.status = 'error';
        entry.error = e instanceof Error ? e.message : 'Upload failed';
      }
      setEntries([...next]);
    }

    const failCount = next.filter((e) => e.status === 'error').length;
    if (failCount > 0) {
      setError(`${failCount} file(s) failed to upload. No store item created — fix and re-run.`);
      setUploading(false);
      return;
    }

    try {
      if (mode === 'pieces') {
        // One item for the whole set. baseUrl is the folder — derived by
        // stripping the filename off any uploaded sprite, so it can never
        // disagree with where the files actually landed.
        const sample = next.find((e) => e.publicUrl)?.publicUrl ?? '';
        const baseUrl = sample.slice(0, sample.lastIndexOf('/'));
        const previewUrl = next.find((e) => stemOf(e.file.name) === 'wK')?.publicUrl ?? sample;
        if (!baseUrl) {
          setError('Uploads succeeded but no public URL came back — item not created.');
          setUploading(false);
          return;
        }
        const item = {
          itemId: crypto.randomUUID(),
          slug: `chess_pieces_${variantSlug}`,
          name: `${capitalize(variantSlug)} Pieces`,
          description: `${capitalize(variantSlug)} piece set for Chess`,
          previewUrl,
          upgradeType: 'game_upgrade',
          category: 'chess',
          gameId: 'chess',
          subcategory: 'pieces',
          type: 'pieces',
          price: { coins: priceCoins, gems: priceGems },
          isActive: true,
          stock: -1,
          metadata: { purchaseLimit: '1', variant: variantSlug, baseUrl },
        };
        await callAdminRpc('store/admin_add_item', JSON.stringify(item));
        setCreatedItems([{ name: item.name, previewUrl }]);
      } else {
        // board / background: one purchasable item per file.
        const created: Array<{ name: string; previewUrl: string }> = [];
        for (const entry of next) {
          if (entry.status !== 'done' || !entry.publicUrl) continue;
          const base = stemOf(entry.file.name);
          const itemName = base
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim();
          const item = {
            itemId: crypto.randomUUID(),
            slug: `chess_${mode}_${variantSlug}_${base.toLowerCase()}`,
            name: itemName || capitalize(variantSlug),
            description: `${itemName} ${mode} for Chess (${capitalize(variantSlug)})`,
            previewUrl: entry.publicUrl,
            upgradeType: 'game_upgrade',
            category: 'chess',
            gameId: 'chess',
            subcategory: mode,
            type: mode,
            price: { coins: priceCoins, gems: priceGems },
            isActive: true,
            stock: -1,
            // assetUrl is what GetChessCosmetics reads; it COALESCEs to
            // preview_url, but setting it explicitly keeps the shop thumbnail
            // free to diverge from the full-res render later.
            metadata: { purchaseLimit: '1', variant: variantSlug, assetUrl: entry.publicUrl },
          };
          try {
            await callAdminRpc('store/admin_add_item', JSON.stringify(item));
            created.push({ name: item.name, previewUrl: entry.publicUrl });
          } catch (e) {
            entry.status = 'error';
            entry.error = e instanceof Error ? e.message : 'admin_add_item failed';
          }
        }
        setEntries([...next]);
        if (created.length === 0) {
          setError('Files reached R2 but no store items were created — check the row errors above.');
          setUploading(false);
          return;
        }
        setCreatedItems(created);
      }
      onUploaded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create store item');
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
      >
        <Plus className="w-4 h-4" /> Upload chess cosmetic
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Upload chess cosmetic</h3>
        <button
          onClick={() => { reset(); setOpen(false); }}
          className="text-xs text-slate-400 hover:text-slate-100"
        >Close</button>
      </div>

      <p className="text-xs text-slate-400">
        <strong>pieces</strong>: drop all 12 sprites named exactly <code>wK wQ wR wB wN wP bK bQ bR bB bN bP</code>. Creates <em>one</em> store item; the renderer resolves each sprite from the folder by FEN letter. Piece sets are visible to your opponent.
        <br />
        <strong>board</strong> / <strong>background</strong>: drop any number of images. Creates <em>one item per file</em>, each independently purchasable. These are per-viewer — only the owner sees them.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <select
            value={mode}
            onChange={(e) => { setMode(e.target.value as Mode); setEntries([]); setCreatedItems(null); setError(''); }}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          >
            <option value="pieces">pieces</option>
            <option value="board">board</option>
            <option value="background">background</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Variant name</label>
          <input
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="walnut, marble, neon, …"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Price (coins)</label>
          <input
            type="number"
            value={priceCoins}
            onChange={(e) => setPriceCoins(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Price (gems)</label>
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
        <p className="text-xs text-slate-400">Click or drop files — WebP / PNG / JPEG.</p>
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
        <div className="rounded-lg bg-slate-900 border border-slate-700 max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 sticky top-0 bg-slate-900">
              <tr>
                <th className="px-2 py-1 text-left">File</th>
                <th className="px-2 py-1 text-left">Key</th>
                {mode === 'pieces' && <th className="px-2 py-1 text-left">Luma</th>}
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-t border-slate-700/50">
                  <td className="px-2 py-1 text-slate-200">{e.file.name}</td>
                  <td className="px-2 py-1 font-mono text-slate-400">{stemOf(e.file.name)}</td>
                  {mode === 'pieces' && (
                    <td className="px-2 py-1 font-mono text-slate-400">
                      {e.luminance === undefined ? '—' : Math.round(e.luminance)}
                    </td>
                  )}
                  <td className="px-2 py-1">
                    {e.status === 'done' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> done</span>}
                    {e.status === 'error' && <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {e.error ?? 'error'}</span>}
                    {e.status === 'uploading' && <span className="text-amber-400">uploading…</span>}
                    {e.status === 'pending' && <span className="text-slate-500">pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'pieces' && entries.length > 0 && missingPieces.length > 0 && (
        <p className="text-xs text-red-400">
          Missing {missingPieces.length} sprite(s): {missingPieces.join(', ')} — upload is blocked until the set is complete.
        </p>
      )}

      {contrastWarnings.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-900/30 border border-amber-700 text-xs text-amber-200 space-y-1">
          <p><strong>Contrast warning</strong> — you can still upload, but check this is intentional:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {contrastWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          <p className="text-amber-300/80">
            In a match each player supplies only their own colour half, so a set with dark
            &ldquo;white&rdquo; pieces makes the board unreadable for both players.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {createdItems && createdItems.length > 0 && (
        <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-700 text-xs text-emerald-200 space-y-1">
          <p>Created {createdItems.length} store item{createdItems.length > 1 ? 's' : ''}:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {createdItems.map((it, i) => (
              <li key={i}><strong>{it.name}</strong> — <code className="break-all">{it.previewUrl}</code></li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={uploadAll}
          disabled={uploading || entries.length === 0}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : `Upload ${entries.length} file(s) + create item`}
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
