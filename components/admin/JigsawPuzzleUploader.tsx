'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { adminUpsertPuzzle, getUploadUrl } from '@/lib/jigsaw-api';

// Jigsaw uploaders — a pack's cover, and the puzzles inside it.
//
// A puzzle is NOT a store item. The pack is the only priced unit (there is no
// price column on jigsaw_puzzles and no store_items row per puzzle, so "buy one
// puzzle" has nothing to point at), which is why nothing here goes through
// store/admin_add_item the way the chess and tero cosmetic uploaders do. Every
// dropped file becomes one jigsaw_puzzles row via jigsaw/admin_upsert_puzzle.
//
// THREE RENDITIONS PER PUZZLE, because they do three different jobs:
//   thumb   (<=480px)  pack grid tiles — a 2048px master in a 180px cell, forty
//                      times over, is how a mid-range Android dies
//   preview (<=1280px) the piece-count settings sheet
//   source  (as dropped) the board, and the only image the client ever cuts
// Both derived sizes are made here in the browser, so publishing a pack never
// waits on a server-side image pipeline that does not exist.
//
// IMAGE DIMENSIONS ARE LOAD-BEARING, not metadata. The backend derives the
// legal piece-count grids from the aspect ratio — 42 pieces is 7x6 for a
// landscape image but 6x7 for a portrait one — so a puzzle stored 0x0 ships a
// wrong piece-count slider to every player who opens it. A file we cannot
// decode is therefore failed, never uploaded.

interface UploadEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  /** The source rendition's URL — what becomes the puzzle's imageUrl. */
  publicUrl?: string;
  error?: string;
  /** Natural pixels of the source, read before anything is uploaded. */
  width?: number;
  height?: number;
  /** blob: URL of the generated thumb. Every one of these must be revoked. */
  previewObjectUrl?: string;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const THUMB_MAX_EDGE = 480;
const PREVIEW_MAX_EDGE = 1280;

/** jigsaw_puzzles.slug is VARCHAR(96). */
const MAX_SLUG_LEN = 96;

/**
 * Below this a 500-piece cut is mush. A warning, never a block: a pack of
 * small images is perfectly legitimate at 42 pieces.
 */
const LOW_RES_EDGE = 1200;

function extOf(name: string): string {
  return name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
}

/**
 * Content type from the extension alone. file.type is deliberately ignored:
 * browsers report .webp as '' or application/octet-stream often enough that
 * trusting it makes the presign reject a perfectly good image.
 */
function contentTypeFor(file: File): string {
  return CONTENT_TYPE_BY_EXT[extOf(file.name)] ?? 'image/webp';
}

/** "Maple Road-2.webp" -> "Maple Road-2". */
function stemOf(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * ("autumn", "Maple Road-2.webp") -> "autumn_maple_road_2".
 *
 * Truncated to the column width because an over-length slug fails in Postgres
 * mid-batch, and "value too long for type character varying(96)" on a row is
 * not something an admin can act on.
 */
function puzzleSlugFor(packSlug: string, stem: string): string {
  return slugify(`${packSlug}_${stem}`).slice(0, MAX_SLUG_LEN);
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
 * One downscaled webp off an already-decoded bitmap.
 *
 * Never upscales: blowing a 320px master up to 1280 and re-encoding it costs
 * bytes and buys nothing, and would also make the "low-res" badge lie.
 */
function renditionOf(bitmap: ImageBitmap, maxEdge: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Could not create canvas context'));
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/webp',
      0.85,
    );
  });
}

interface Derived {
  width: number;
  height: number;
  preview: Blob;
  thumb: Blob;
}

/** Decode once, measure, then emit both derived renditions off the same bitmap. */
async function decodeAndDerive(file: File): Promise<Derived> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Failing the row is the point. Uploading an image whose size we never read
    // publishes a puzzle whose piece-count slider is wrong for every player,
    // which is a worse outcome than not publishing it at all.
    throw new Error('Could not decode this image — re-export it as WebP, PNG or JPEG');
  }
  try {
    return {
      width: bitmap.width,
      height: bitmap.height,
      preview: await renditionOf(bitmap, PREVIEW_MAX_EDGE),
      thumb: await renditionOf(bitmap, THUMB_MAX_EDGE),
    };
  } finally {
    bitmap.close();
  }
}

interface PresignBody {
  itemType: 'jigsaw_pack_cover' | 'jigsaw_puzzle_image';
  category: string;
  subcategory?: string;
  contentType: string;
}

/**
 * Presign, then PUT straight at R2 — the binary never passes through the
 * Next.js route, whose function budget a 2048px master would blow.
 *
 * fileName is sent empty on purpose. Both jigsaw item types key their object on
 * a fresh UUID server-side rather than on the name, so a replaced cover or
 * image lands at a brand-new URL instead of overwriting in place — and a URL
 * nobody has served is the only thing that misses every CDN and on-device cache
 * between here and a player's screen at once. The orphaned object is the
 * cheaper mistake.
 */
async function presignAndPut(body: PresignBody, blob: Blob): Promise<string> {
  const data = await getUploadUrl(body.itemType, body.category, body.subcategory ?? '', '', body.contentType);
  if (!data?.uploadUrl || !data?.publicUrl) throw new Error('Bad presign response');
  const res = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': body.contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`R2 PUT failed: ${res.status}`);
  return data.publicUrl;
}

function revokePreviews(list: UploadEntry[]) {
  for (const e of list) {
    if (e.previewObjectUrl) URL.revokeObjectURL(e.previewObjectUrl);
  }
}

/**
 * The pack's shop / shelf tile. Uploaded raw at whatever size the admin
 * exported: a cover is one image on one screen, so it earns no derived sizes.
 *
 * This only puts the file in R2 and hands back the URL — persisting it is the
 * pack form's job, via the coverUrl patch field on jigsaw/admin_upsert_pack.
 */
export function JigsawPackCoverUploader({
  packSlug,
  onUploaded,
}: {
  packSlug: string;
  onUploaded: (url: string) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [coverUrl, setCoverUrl] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    // category is the R2 folder, so an unsaved pack would file its cover under
    // "general" alongside every other slugless upload.
    if (!packSlug) {
      setStatus('error');
      setError('Give the pack a slug first — it is the R2 folder the cover lands in.');
      return;
    }
    setStatus('uploading');
    setError('');
    try {
      const url = await presignAndPut(
        { itemType: 'jigsaw_pack_cover', category: packSlug, contentType: contentTypeFor(file) },
        file,
      );
      setCoverUrl(url);
      setStatus('done');
      onUploaded(url);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="rounded-lg border-2 border-dashed border-slate-600 p-3 text-center cursor-pointer hover:border-slate-500"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files?.[0]); }}
      >
        <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
        <p className="text-xs text-slate-300">
          {status === 'uploading' ? 'Uploading cover…' : 'Click or drop the pack cover'}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">WebP / PNG / JPEG — one file</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/webp,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </div>

      {status === 'done' && coverUrl && (
        <div className="flex items-center gap-2">
          {/* Plain <img>: the R2 host is not in next.config images.remotePatterns. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt="Pack cover"
            className="w-12 h-12 rounded object-cover border border-slate-700"
          />
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Uploaded — save the pack to keep it.
          </span>
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

export default function JigsawPuzzleUploader({
  packId,
  packSlug,
  onUploaded,
}: {
  packId: string;
  packSlug: string;
  onUploaded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Unmount is the one exit path no handler can cover, so the live entries are
  // mirrored into a ref the cleanup can still read. Without this, closing the
  // page mid-batch leaks every generated thumb.
  const liveEntries = useRef<UploadEntry[]>([]);
  useEffect(() => { liveEntries.current = entries; }, [entries]);
  useEffect(() => () => revokePreviews(liveEntries.current), []);

  const reset = () => {
    revokePreviews(entries);
    setEntries([]);
    setCreatedCount(null);
    setError('');
  };

  function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Ignored mid-batch. The upload loop writes its own copy of the list back on
    // every transition, so a fresh selection would be silently replaced by the
    // batch still in flight — and revoking the old thumbs would blank the rows
    // that loop is still rendering.
    if (uploading) return;
    const picked = Array.from(files);
    // Filtered on the extension rather than passed through contentTypeFor,
    // which falls back to webp: a folder drop carries .DS_Store and stray
    // sidecar files, and each one would otherwise become a puzzle.
    const images = picked.filter((f) => extOf(f.name) in CONTENT_TYPE_BY_EXT);

    revokePreviews(entries);
    setEntries(images.map((file) => ({ file, status: 'pending' as const })));
    setCreatedCount(null);
    setError(
      images.length < picked.length
        ? `Ignored ${picked.length - images.length} non-image file(s) — puzzles must be WebP, PNG or JPEG.`
        : '',
    );
  }

  async function submit() {
    if (!packId || !packSlug) {
      setError('Save the pack first — puzzles need its id and slug before they can be filed.');
      return;
    }
    if (entries.length === 0) {
      setError('Drop at least one image.');
      return;
    }

    setUploading(true);
    setError('');
    setCreatedCount(null);

    const next = entries.map((e) => ({ ...e }));

    // Strictly sequential. Three PUTs per puzzle across forty files in parallel
    // would open 120 sockets and starve the presign calls that gate them.
    for (let i = 0; i < next.length; i++) {
      const entry = next[i];
      // A re-run after a partial failure retries only what failed. Re-uploading
      // a finished puzzle burns three fresh R2 objects and orphans three more.
      if (entry.status === 'done') continue;

      entry.status = 'uploading';
      entry.error = undefined;
      setEntries([...next]);

      try {
        const { width, height, preview, thumb } = await decodeAndDerive(entry.file);
        entry.width = width;
        entry.height = height;

        const imageUrl = await presignAndPut(
          {
            itemType: 'jigsaw_puzzle_image',
            category: packSlug,
            subcategory: 'source',
            contentType: contentTypeFor(entry.file),
          },
          entry.file,
        );
        const previewUrl = await presignAndPut(
          {
            itemType: 'jigsaw_puzzle_image',
            category: packSlug,
            subcategory: 'preview',
            contentType: 'image/webp',
          },
          preview,
        );
        const thumbUrl = await presignAndPut(
          {
            itemType: 'jigsaw_puzzle_image',
            category: packSlug,
            subcategory: 'thumb',
            contentType: 'image/webp',
          },
          thumb,
        );

        // puzzleId omitted = create, keyed on slug, so re-running a batch over
        // the same filenames repoints an existing puzzle at the new art instead
        // of duplicating it. sortOrder and isActive are left unsent: they are
        // patch fields, and sending them would clobber an order the admin set by
        // hand in the pack editor.
        const stem = stemOf(entry.file.name);
        await adminUpsertPuzzle({
          slug: puzzleSlugFor(packSlug, stem),
          packId,
          name: titleize(stem),
          imageUrl,
          previewUrl,
          thumbUrl,
          imageWidth: width,
          imageHeight: height,
          sizeBytes: entry.file.size,
        });

        // The row thumbnail is the 480px rendition we just generated, never the
        // source file: forty 4000px masters shown at 32px would each decode at
        // full size and stay pinned for the life of the panel.
        if (entry.previewObjectUrl) URL.revokeObjectURL(entry.previewObjectUrl);
        entry.previewObjectUrl = URL.createObjectURL(thumb);
        entry.publicUrl = imageUrl;
        entry.status = 'done';
      } catch (e) {
        // One bad file does not abort the batch. Every dropped image becomes its
        // own puzzle row, so the ones that worked are real and keeping them is
        // strictly better than rolling back forty good uploads over one.
        entry.status = 'error';
        entry.error = e instanceof Error ? e.message : 'Failed';
      }
      setEntries([...next]);
    }

    const succeeded = next.filter((e) => e.status === 'done').length;
    setCreatedCount(succeeded);
    if (succeeded < next.length) {
      setError(
        `${next.length - succeeded} of ${next.length} failed — see the rows above. The rest were created; ` +
          'press Upload again to retry only the failures.',
      );
    }
    if (succeeded > 0) onUploaded?.();
    setUploading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
      >
        <Plus className="w-4 h-4" /> Add puzzles
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Add puzzles to <code className="text-slate-300">{packSlug || '—'}</code>
        </h3>
        <button
          onClick={() => { reset(); setOpen(false); }}
          className="text-xs text-slate-400 hover:text-slate-100"
        >Close</button>
      </div>

      <p className="text-xs text-slate-400">
        Drop as many images as you like — <strong>each one becomes a puzzle in this pack</strong>.
        Puzzles are never priced; players get them by owning the pack. The name and slug come
        from the filename, so <code>maple-road.webp</code> publishes as <strong>Maple Road</strong>.
        Each file is uploaded three times — full-size for the board, {PREVIEW_MAX_EDGE}px for the
        settings sheet, {THUMB_MAX_EDGE}px for the grid tile — all generated here in the browser.
      </p>

      <div
        className={`rounded-lg border-2 border-dashed p-4 text-center ${
          uploading ? 'border-slate-700 opacity-60' : 'border-slate-600 cursor-pointer hover:border-slate-500'
        }`}
        onClick={() => { if (!uploading) inputRef.current?.click(); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFilesPicked(e.dataTransfer.files); }}
      >
        <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
        <p className="text-xs text-slate-300">Drop puzzle images — WebP / PNG / JPEG</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Click or drop — multiple files supported</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/webp,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => onFilesPicked(e.target.files)}
        />
      </div>

      {entries.length > 0 && (
        <div className="rounded-lg bg-slate-900 border border-slate-700 max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 sticky top-0 bg-slate-900">
              <tr>
                <th className="px-2 py-1 text-left w-10" />
                <th className="px-2 py-1 text-left">Puzzle name</th>
                <th className="px-2 py-1 text-left">Slug</th>
                <th className="px-2 py-1 text-left">Source file</th>
                <th
                  className="px-2 py-1 text-left"
                  title="Read from the image before upload. The legal piece-count grids are derived from this aspect ratio, so a puzzle stored without it gets a wrong piece-count slider."
                >
                  Pixels
                </th>
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const stem = stemOf(e.file.name);
                const longEdge = Math.max(e.width ?? 0, e.height ?? 0);
                return (
                  <tr key={i} className="border-t border-slate-700/50">
                    <td className="px-2 py-1">
                      {e.previewObjectUrl ? (
                        // Plain <img>: a blob: URL cannot go through next/image.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.previewObjectUrl}
                          alt={stem}
                          className="w-8 h-8 rounded object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700" />
                      )}
                    </td>
                    <td className="px-2 py-1 text-slate-200">{titleize(stem)}</td>
                    <td className="px-2 py-1 font-mono text-slate-500">
                      {puzzleSlugFor(packSlug, stem)}
                    </td>
                    <td className="px-2 py-1 text-slate-400">
                      {e.file.name} · {prettyBytes(e.file.size)}
                    </td>
                    <td className="px-2 py-1 font-mono text-slate-400">
                      {e.width && e.height ? (
                        <>
                          {e.width}×{e.height}
                          {longEdge < LOW_RES_EDGE && (
                            <span
                              className="ml-1 text-amber-400"
                              title={`Under ${LOW_RES_EDGE}px on the long edge — fine at 42 pieces, mush at 500.`}
                            >low-res</span>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {e.status === 'done' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> created</span>}
                      {e.status === 'error' && <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {e.error ?? 'error'}</span>}
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
        <p className="text-xs text-emerald-200 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700">
          {createdCount} puzzle{createdCount > 1 ? 's are' : ' is'} in the pack. Anyone who already
          owns it sees {createdCount > 1 ? 'them' : 'it'} on their next open — no re-purchase.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => void submit()}
          disabled={uploading || entries.length === 0}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : `Upload ${entries.length || ''} puzzle${entries.length === 1 ? '' : 's'}`}
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
