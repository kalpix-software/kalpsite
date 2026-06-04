'use client';

import { useRef, useState } from 'react';
import { Plus, Upload, CheckCircle2, AlertCircle, Wand2, ImageIcon } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// Tero VIDEO background uploader.
//
// One MP4 + one poster image = one store_item with metadata:
//   { variant, mediaType: "video", assetUrl: <mp4 url> }
// PreviewUrl points at the poster; FE reads previewUrl for the grid
// thumbnail and assetUrl when the user taps to preview / equips it in
// match.
//
// Poster source — admin's choice:
//   - "Auto-extract" (default): the browser loads the MP4 into a
//     <video> element, seeks to a sensible frame (10% in, capped at 2s)
//     and rasterizes that frame to a <canvas>. canvas.toBlob() gives a
//     webp Blob we upload alongside the video. No backend ffmpeg
//     needed; works for any MP4 the browser can decode.
//   - "Upload your own": admin drops a .webp/.png/.jpg poster file
//     explicitly. Use when the auto-extracted frame isn't visually
//     representative (e.g. video starts with a black fade-in).

type PosterSource = 'auto' | 'manual';

type UploadStatus = 'idle' | 'extracting' | 'uploading_video' | 'uploading_poster' | 'creating_item' | 'done' | 'error';

function statusLabel(s: UploadStatus): string {
  switch (s) {
    case 'idle': return '';
    case 'extracting': return 'Extracting poster frame…';
    case 'uploading_video': return 'Uploading video…';
    case 'uploading_poster': return 'Uploading poster…';
    case 'creating_item': return 'Creating store item…';
    case 'done': return 'Done';
    case 'error': return 'Failed';
  }
}

// Extract a single still frame from an MP4 File into a webp Blob, via
// the browser's <video> + <canvas> pipeline. No external libraries.
// Seeks to min(2s, 10% of duration) so the first dark/credits frames
// are skipped — feels good for most game-background videos.
async function extractPosterFromVideo(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener('loadedmetadata', () => {
      const seekTo = Math.min(2, Math.max(0.05, video.duration * 0.1));
      video.currentTime = seekTo;
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Could not create canvas context'));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error('canvas.toBlob returned null'));
              return;
            }
            resolve(blob);
          },
          'image/webp',
          0.9,
        );
      } catch (e) {
        cleanup();
        reject(e);
      }
    });

    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('Failed to load video for poster extraction'));
    });
  });
}

// Slug-safe lowercased ASCII string from a free-form name.
function toSlug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export default function VideoBackgroundUploader({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState('anime');
  const [itemName, setItemName] = useState('');
  const [priceCoins, setPriceCoins] = useState(500);
  const [priceGems, setPriceGems] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterSource, setPosterSource] = useState<PosterSource>('auto');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState('');
  const [createdUrl, setCreatedUrl] = useState<{ video: string; poster: string } | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setVariant('anime');
    setItemName('');
    setPriceCoins(500);
    setPriceGems(0);
    setVideoFile(null);
    setPosterSource('auto');
    setPosterFile(null);
    setStatus('idle');
    setError('');
    setCreatedUrl(null);
  };

  const uploadOne = async (file: Blob, fileName: string, contentType: string, variantSlug: string) => {
    const raw = await callAdminRpc(
      'store/admin_get_upload_url',
      JSON.stringify({
        itemType: 'game_deck_asset',
        category: 'tero',
        subcategory: 'background',
        variant: variantSlug,
        fileName,
        contentType,
      }),
    );
    const data = unwrapAdminRpcData<{ uploadUrl: string; publicUrl: string }>(raw);
    if (!data?.uploadUrl || !data?.publicUrl) throw new Error('Bad presign response');
    const putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!putRes.ok) throw new Error(`R2 PUT failed: ${putRes.status}`);
    return data.publicUrl;
  };

  const submit = async () => {
    setError('');
    setCreatedUrl(null);

    if (!variant.trim()) { setError('Variant name is required.'); return; }
    if (!itemName.trim()) { setError('Item name is required.'); return; }
    if (!videoFile) { setError('Pick an MP4 video file.'); return; }
    if (videoFile.type !== 'video/mp4') {
      setError(`Video must be MP4. Got: ${videoFile.type || 'unknown'}`); return;
    }
    if (posterSource === 'manual' && !posterFile) {
      setError('Pick a poster image or switch to Auto-extract.'); return;
    }

    const variantSlug = toSlug(variant);
    const itemSlug = toSlug(itemName);
    const videoBaseName = itemSlug + '.mp4';
    const posterBaseName = itemSlug + '_poster.webp';

    try {
      // Step 1: poster — extract OR validate the manual upload
      let posterBlob: Blob;
      if (posterSource === 'auto') {
        setStatus('extracting');
        posterBlob = await extractPosterFromVideo(videoFile);
      } else {
        posterBlob = posterFile!;
      }

      // Step 2: upload video to R2
      setStatus('uploading_video');
      const videoUrl = await uploadOne(videoFile, videoBaseName, 'video/mp4', variantSlug);

      // Step 3: upload poster to R2 (always webp on the wire — auto-
      // extracted blob is webp; manual upload gets re-typed if needed)
      setStatus('uploading_poster');
      const posterContentType = posterSource === 'auto' ? 'image/webp' : (posterFile!.type || 'image/webp');
      const posterUrl = await uploadOne(posterBlob, posterBaseName, posterContentType, variantSlug);

      // Step 4: create the store_item with mediaType=video metadata
      setStatus('creating_item');
      await callAdminRpc(
        'store/admin_add_item',
        JSON.stringify({
          itemId: crypto.randomUUID(),
          slug: `tero_background_${variantSlug}_${itemSlug}`,
          name: capitalize(itemName.trim()),
          description: `${capitalize(itemName.trim())} animated background for Tero (${capitalize(variantSlug)} variant)`,
          previewUrl: posterUrl,
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
            mediaType: 'video',
            assetUrl: videoUrl,
          },
        }),
      );

      setStatus('done');
      setCreatedUrl({ video: videoUrl, poster: posterUrl });
      onUploaded?.();
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500"
      >
        <Plus className="w-4 h-4" /> Upload video background
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Upload Tero video background</h3>
        <button onClick={() => { reset(); setOpen(false); }} className="text-xs text-slate-400 hover:text-slate-100">Close</button>
      </div>
      <p className="text-xs text-slate-400">
        One MP4 + one poster image = one store_item with <code className="bg-slate-700 px-1 rounded">mediaType: &quot;video&quot;</code>.
        The poster shows in the shop grid; the MP4 plays in the detail view and during matches.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Variant (anime/noir/space/…)</label>
          <input
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="anime"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Item name</label>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Neon Pulse"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Price (coins)</label>
          <input type="number" value={priceCoins} onChange={(e) => setPriceCoins(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Price (gems)</label>
          <input type="number" value={priceGems} onChange={(e) => setPriceGems(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm" />
        </div>
      </div>

      {/* Video drop */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Video (MP4)</label>
        <div
          onClick={() => videoInputRef.current?.click()}
          className="rounded-lg border-2 border-dashed border-slate-600 p-3 text-center cursor-pointer hover:border-slate-500 text-xs"
        >
          {videoFile ? (
            <span className="text-slate-200">{videoFile.name} <span className="text-slate-500">({Math.round(videoFile.size / 1024)} KB)</span></span>
          ) : (
            <span className="text-slate-400 flex items-center justify-center gap-1"><Upload className="w-4 h-4" /> Click or drop an MP4</span>
          )}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4"
            className="hidden"
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {/* Poster source */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Poster image</label>
        <div className="flex gap-3 text-xs text-slate-200">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={posterSource === 'auto'} onChange={() => setPosterSource('auto')} />
            <Wand2 className="w-3 h-3" /> Auto-extract from video
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={posterSource === 'manual'} onChange={() => setPosterSource('manual')} />
            <ImageIcon className="w-3 h-3" /> Upload my own
          </label>
        </div>
        {posterSource === 'auto' && (
          <p className="text-xs text-slate-500 mt-1">
            Browser will load the MP4, seek ~10% in (capped at 2s), and rasterize that frame to a webp. No server-side ffmpeg.
          </p>
        )}
        {posterSource === 'manual' && (
          <div
            onClick={() => posterInputRef.current?.click()}
            className="rounded-lg border-2 border-dashed border-slate-600 p-3 text-center cursor-pointer hover:border-slate-500 text-xs mt-1"
          >
            {posterFile ? (
              <span className="text-slate-200">{posterFile.name} <span className="text-slate-500">({Math.round(posterFile.size / 1024)} KB)</span></span>
            ) : (
              <span className="text-slate-400">Click or drop a poster (.webp / .png / .jpg)</span>
            )}
            <input
              ref={posterInputRef}
              type="file"
              accept="image/webp,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</p>}
      {status !== 'idle' && status !== 'done' && status !== 'error' && (
        <p className="text-xs text-amber-400">{statusLabel(status)}</p>
      )}
      {createdUrl && (
        <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-700 text-xs text-emerald-200 space-y-1">
          <p className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Item created.</p>
          <p>Video: <code className="break-all">{createdUrl.video}</code></p>
          <p>Poster: <code className="break-all">{createdUrl.poster}</code></p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={status === 'extracting' || status === 'uploading_video' || status === 'uploading_poster' || status === 'creating_item'}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-50"
        >
          {(status === 'extracting' || status === 'uploading_video' || status === 'uploading_poster' || status === 'creating_item') ? 'Working…' : 'Upload + create'}
        </button>
        <button onClick={reset} disabled={status === 'extracting' || status === 'uploading_video' || status === 'uploading_poster'} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm hover:bg-slate-600 disabled:opacity-50">
          Reset
        </button>
      </div>
    </div>
  );
}
