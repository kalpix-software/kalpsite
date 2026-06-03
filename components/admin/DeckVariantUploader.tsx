'use client';

import { useState, useRef } from 'react';
import { Plus, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// Tero card-deck variant uploader.
//
// Mental model: a "variant" (e.g. anime / noir / space) is a folder of
// 59 card-face images keyed by convention filenames (red_0.webp,
// blue_skip.webp, wild.webp, back.webp, …). The admin types the variant
// name, drops all files at once, and we:
//   1. presign each file via store/admin_get_upload_url (itemType =
//      game_deck_asset) so it lands at
//      games/tero/{subcategory}/{variant}/{fileName} on R2
//   2. PUT each file directly to R2
//   3. after every file uploads, create ONE store_items row pointing at
//      back.webp (for card_decks) or the first file (for background)
//      as previewUrl. The other 58 fronts are NOT separate store rows —
//      the FE resolves them from the same folder by convention.
//
// This component intentionally lives outside the existing AddItemForm
// because its model is different: one folder → one store item, not one
// image → one item. Trying to share state would make both forms harder
// to read.

type Subcategory = 'card_decks' | 'background';

interface UploadEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  publicUrl?: string;
  error?: string;
}

// Canonical face keys the FE expects for a complete card_decks variant.
// Missing files are flagged in the UI but don't block upload — admin may
// be iterating on a partial set. The "back" face is the one we surface
// as the store-item preview.
const CARD_DECK_FACE_KEYS = [
  'back',
  // 4 colors × (0–9 + skip + reverse + draw_two) = 52 fronts
  ...['red', 'blue', 'green', 'yellow'].flatMap((c) => [
    ...Array.from({ length: 10 }, (_, i) => `${c}_${i}`),
    `${c}_skip`,
    `${c}_reverse`,
    `${c}_draw_two`,
  ]),
  'wild',
  'wild_draw_four',
  'blue_thunder',
  'shield',
  'skip_blast',
  'red_fury',
];

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

function contentTypeFor(file: File): string {
  if (file.type && CONTENT_TYPE_BY_EXT[`.${file.name.split('.').pop()?.toLowerCase()}`] === file.type) {
    return file.type;
  }
  const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
  return CONTENT_TYPE_BY_EXT[ext] ?? 'image/webp';
}

function faceKeyFromFileName(name: string): string {
  // Drop extension, lowercase. "Red_0.WEBP" → "red_0".
  return name.replace(/\.[^.]+$/, '').toLowerCase();
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function DeckVariantUploader({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState('anime');
  const [subcategory, setSubcategory] = useState<Subcategory>('card_decks');
  const [priceCoins, setPriceCoins] = useState(500);
  const [priceGems, setPriceGems] = useState(0);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  // After upload, holds the list of store_items just created:
  //   card_decks: exactly one entry (the variant pack itself)
  //   background: N entries (one per uploaded image)
  const [createdItems, setCreatedItems] = useState<Array<{ name: string; previewUrl: string }> | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setVariant('anime');
    setSubcategory('card_decks');
    setPriceCoins(500);
    setPriceGems(0);
    setEntries([]);
    setCreatedItems(null);
    setError('');
  };

  const onFilesPicked = (files: FileList | null) => {
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
  };

  const presentFaceKeys = new Set(entries.map((e) => faceKeyFromFileName(e.file.name)));
  const missingForCardDecks =
    subcategory === 'card_decks'
      ? CARD_DECK_FACE_KEYS.filter((k) => !presentFaceKeys.has(k))
      : [];
  const hasBack = presentFaceKeys.has('back');

  async function uploadAll() {
    if (!variant.trim()) {
      setError('Variant name is required (e.g. anime, noir, space).');
      return;
    }
    if (entries.length === 0) {
      setError('Drop at least one file before uploading.');
      return;
    }
    if (subcategory === 'card_decks' && !hasBack) {
      setError('A back.webp file is required for card_decks variants (used as the store preview).');
      return;
    }

    setUploading(true);
    setError('');
    setCreatedItems(null);

    const variantSlug = variant.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    let backPublicUrl = '';
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
            category: 'tero',
            subcategory,
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
        if (faceKeyFromFileName(entry.file.name) === 'back') {
          backPublicUrl = data.publicUrl;
        }
      } catch (e) {
        entry.status = 'error';
        entry.error = e instanceof Error ? e.message : 'Upload failed';
      }
      setEntries([...next]);
    }

    const successCount = next.filter((e) => e.status === 'done').length;
    const failCount = next.filter((e) => e.status === 'error').length;
    if (failCount > 0) {
      setError(`${failCount} file(s) failed to upload. Item not created — fix and re-run.`);
      setUploading(false);
      return;
    }
    if (successCount === 0) {
      setError('No files uploaded successfully.');
      setUploading(false);
      return;
    }

    // Create store items. Two modes:
    //   card_decks: one store_item for the whole variant; previewUrl = back.webp
    //               (the 58 fronts are resolved by FE convention at render time)
    //   background: one store_item per uploaded file. Each is its own
    //               purchasable + equippable item; the variant is just a
    //               grouping tag on metadata.variant. Bundles can later
    //               aggregate them.
    try {
      if (subcategory === 'card_decks') {
        if (!backPublicUrl) {
          setError('back.webp upload succeeded but URL missing — item not created.');
          setUploading(false);
          return;
        }
        const item = {
          itemId: crypto.randomUUID(),
          name: capitalize(variantSlug),
          description: `${capitalize(variantSlug)} card deck for Tero`,
          previewUrl: backPublicUrl,
          upgradeType: 'game_upgrade',
          category: 'tero',
          gameId: 'tero',
          subcategory,
          type: subcategory,
          price: { coins: priceCoins, gems: priceGems },
          isActive: true,
          stock: -1,
          metadata: { purchaseLimit: '1', variant: variantSlug },
        };
        await callAdminRpc('store/admin_add_item', JSON.stringify(item));
        setCreatedItems([{ name: item.name, previewUrl: backPublicUrl }]);
      } else {
        // background: one item per file.
        const created: Array<{ name: string; previewUrl: string }> = [];
        for (const entry of next) {
          if (entry.status !== 'done' || !entry.publicUrl) continue;
          const baseFileName = entry.file.name.replace(/\.[^.]+$/, '');
          const itemName = baseFileName
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim();
          const item = {
            itemId: crypto.randomUUID(),
            // Stable, predictable slug. If admin re-runs the same upload
            // they'll hit a duplicate-slug collision server-side — easier
            // to surface than a silent overwrite.
            slug: `tero_background_${variantSlug}_${baseFileName.toLowerCase()}`,
            name: itemName || capitalize(variantSlug),
            description: `${itemName} background for Tero (${capitalize(variantSlug)} variant)`,
            previewUrl: entry.publicUrl,
            upgradeType: 'game_upgrade',
            category: 'tero',
            gameId: 'tero',
            subcategory,
            type: subcategory,
            price: { coins: priceCoins, gems: priceGems },
            isActive: true,
            stock: -1,
            metadata: { purchaseLimit: '1', variant: variantSlug },
          };
          try {
            await callAdminRpc('store/admin_add_item', JSON.stringify(item));
            created.push({ name: item.name, previewUrl: entry.publicUrl });
          } catch (e) {
            // Partial-fail visibility: any per-item create error gets
            // attached to that file's row so admin sees which one to fix.
            entry.status = 'error';
            entry.error = e instanceof Error ? e.message : 'admin_add_item failed';
          }
        }
        setEntries([...next]);
        if (created.length === 0) {
          setError('All files uploaded to R2 but no store items were created — check the row errors above.');
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
        <Plus className="w-4 h-4" /> Upload deck/background variant
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Upload Tero variant</h3>
        <button
          onClick={() => { reset(); setOpen(false); }}
          className="text-xs text-slate-400 hover:text-slate-100"
        >Close</button>
      </div>
      <p className="text-xs text-slate-400">
        <strong>card_decks</strong>: drop all 59 face images (red_0.webp … blue_thunder.webp, plus back.webp). Creates <em>one</em> store_item for the whole variant; the FE resolves all faces by convention from the back URL.
        <br />
        <strong>background</strong>: drop any number of background images, each named in snake_case (e.g. <code>morning_garden.webp</code>). Creates <em>one store_item per file</em>; each is independently purchasable and equippable. The variant tag groups them in the shop UI; all files land under the same R2 folder.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Variant name</label>
          <input
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="anime, noir, space, …"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Subcategory</label>
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value as Subcategory)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          >
            <option value="card_decks">card_decks</option>
            <option value="background">background</option>
          </select>
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
        onDrop={(e) => { e.preventDefault(); onFilesPicked(e.dataTransfer.files); }}
      >
        <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
        <p className="text-xs text-slate-400">
          Click or drop files — WebP / PNG / JPEG / GIF.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/webp,image/png,image/jpeg,image/gif"
          className="hidden"
          onChange={(e) => onFilesPicked(e.target.files)}
        />
      </div>

      {entries.length > 0 && (
        <div className="rounded-lg bg-slate-900 border border-slate-700 max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 sticky top-0 bg-slate-900">
              <tr><th className="px-2 py-1 text-left">File</th><th className="px-2 py-1 text-left">Face key</th><th className="px-2 py-1 text-left">Status</th></tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-t border-slate-700/50">
                  <td className="px-2 py-1 text-slate-200">{e.file.name}</td>
                  <td className="px-2 py-1 font-mono text-slate-400">{faceKeyFromFileName(e.file.name)}</td>
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

      {subcategory === 'card_decks' && entries.length > 0 && missingForCardDecks.length > 0 && (
        <p className="text-xs text-amber-400">
          Heads up: {missingForCardDecks.length} canonical face(s) not included. The store item will still be created,
          but the FE will fall back to bundled defaults for missing faces. Missing: {missingForCardDecks.slice(0, 8).join(', ')}{missingForCardDecks.length > 8 ? '…' : ''}
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {createdItems && createdItems.length > 0 && (
        <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-700 text-xs text-emerald-200 space-y-1">
          <p>Created {createdItems.length} store item{createdItems.length > 1 ? 's' : ''}:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {createdItems.map((it, i) => (
              <li key={i}>
                <strong>{it.name}</strong> — <code className="break-all">{it.previewUrl}</code>
              </li>
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
          onClick={() => { reset(); }}
          disabled={uploading}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm hover:bg-slate-600 disabled:opacity-50"
        >Reset</button>
      </div>
    </div>
  );
}
