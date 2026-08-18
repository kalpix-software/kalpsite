'use client';

import { useState, useRef } from 'react';
import { Plus, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// Tero card-deck variant uploader.
//
// Mental model: a "variant" (e.g. anime / noir / space) needs exactly one
// image here — back.webp — which becomes the store item's previewUrl (the
// shop / upgrade tile thumbnail). The in-game card art does NOT come from
// this uploader: the client renders every face and the back out of the
// {variant}.webp + {variant}.atlas.txt pair pushed by DeckAtlasUploader.
// Uploading the 59 individual faces is dead weight — nothing fetches them.
//
// The admin types the variant name, drops the file(s), and we:
//   1. presign each file via store/admin_get_upload_url (itemType =
//      game_deck_asset) so it lands at
//      games/tero/{subcategory}/{variant}/{fileName} on R2
//   2. PUT each file directly to R2
//   3. after every file uploads, create ONE store_items row pointing at
//      back.webp (for card_decks) as previewUrl, or one row per file
//      (for background).
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
  // What players see in the shop. Kept separate from `variant`, which is the
  // slug the backend keys art off and must stay lowercase/stable. Empty means
  // "derive it", so the old behaviour is still one keystroke away.
  const [displayName, setDisplayName] = useState('');
  // Which uploaded file becomes the store thumbnail. Empty = auto-pick the one
  // called "back", preserving the previous convention without mandating it.
  const [previewFile, setPreviewFile] = useState('');
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
    setDisplayName('');
    setPreviewFile('');
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
    // A pick from a previous drop names a file that is no longer here, which
    // would silently produce an item with no preview.
    setPreviewFile('');
    setCreatedItems(null);
    setError('');
  };

  const presentFaceKeys = new Set(entries.map((e) => faceKeyFromFileName(e.file.name)));
  // The chosen preview: an explicit pick, else a file named "back", else — when
  // exactly one file was dropped — that file. Only genuinely ambiguous cases
  // now need a decision from the admin.
  const autoPreviewName =
    entries.find((e) => faceKeyFromFileName(e.file.name) === 'back')?.file.name
    ?? (entries.length === 1 ? entries[0].file.name : '');
  const effectivePreviewName = previewFile || autoPreviewName;
  const hasBack = effectivePreviewName !== '';
  // Anything beyond back.webp on a card_decks upload is unused by the client.
  const unusedCardDeckFiles =
    subcategory === 'card_decks' ? entries.length - (hasBack ? 1 : 0) : 0;

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
      setError('Choose which file is the store preview (the "Preview image" dropdown below).');
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
        if (entry.file.name === effectivePreviewName) {
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
    //               (in-game card art comes from the sprite + atlas pair, not here)
    //   background: one store_item per uploaded file. Each is its own
    //               purchasable + equippable item; the variant is just a
    //               grouping tag on metadata.variant. Bundles can later
    //               aggregate them.
    try {
      if (subcategory === 'card_decks') {
        if (!backPublicUrl) {
          setError('The preview image uploaded but its URL is missing — item not created.');
          setUploading(false);
          return;
        }
        const shopName = displayName.trim() || capitalize(variantSlug);
        const item = {
          itemId: crypto.randomUUID(),
          name: shopName,
          description: `${shopName} card deck for Tero`,
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
            // assetUrl/mediaType are what GetEquippedBackgroundAsset reads to
            // render the table. Omitting them produced a background with no
            // background: listed in the shop, purchasable, equippable, and then
            // nothing on the table. Everything uploaded through this path is a
            // still, so mediaType is "image" — use /admin/cosmetics for video,
            // which also pairs each file with its poster.
            metadata: {
              purchaseLimit: '1',
              variant: variantSlug,
              assetUrl: entry.publicUrl,
              mediaType: 'image',
            },
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
        <strong>card_decks</strong>: drop one image to act as the shop / upgrade tile thumbnail — any filename. A file called <code>back</code> is picked automatically, otherwise choose it below. Creates <em>one</em> store_item for the variant. The actual in-game card art comes from the <strong>sprite + atlas</strong> uploader ({'{variant}'}.webp + {'{variant}'}.atlas.txt); individual face images are never fetched by the app.
        <br />
        <strong>background</strong>: drop any number of background images, each named in snake_case (e.g. <code>morning_garden.webp</code>). Creates <em>one store_item per file</em>; each is independently purchasable and equippable. The variant tag groups them in the shop UI; all files land under the same R2 folder.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Variant slug <span className="text-slate-500">(internal)</span>
          </label>
          <input
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="anime, noir, space, …"
            title="Used to build R2 paths and match the sprite/atlas pair. Lowercase, stable — changing it later orphans the uploaded art."
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Display name <span className="text-slate-500">(shown to players)</span>
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={capitalize(variant.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')) || 'Auto from slug'}
            title="Leave blank to derive it from the slug."
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

      {subcategory === 'card_decks' && entries.length > 0 && (
        <div className="max-w-md">
          <label className="block text-xs text-slate-400 mb-1">Preview image <span className="text-slate-500">(the shop thumbnail)</span></label>
          <select
            value={effectivePreviewName}
            onChange={(e) => setPreviewFile(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          >
            <option value="">— choose a file —</option>
            {entries.map((e) => (
              <option key={e.file.name} value={e.file.name}>
                {e.file.name}{e.file.name === autoPreviewName && !previewFile ? '  (auto-selected)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {unusedCardDeckFiles > 0 && (
        <p className="text-xs text-amber-400">
          Heads up: {unusedCardDeckFiles} file(s) beyond the preview will be uploaded to R2 but never fetched
          by the app — card faces are rendered from the sprite + atlas pair. Drop just the preview image unless you
          have a reason to keep them.
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
