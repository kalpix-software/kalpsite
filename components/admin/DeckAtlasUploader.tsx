'use client';

import { useState, useRef } from 'react';
import { Plus, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

// Tero card-deck SPRITE-ATLAS uploader (new asset format).
//
// Instead of 59 individual card images, a variant is now ONE sprite sheet
// ({variant}.webp) + an atlas ({variant}.atlas.txt) describing each card's
// bounds — same model as the avatar Spine assets. The FE downloads + caches
// the pair the first time it sees a match.
//
// Both files upload straight to R2 from kalpsite (browser -> Vercel -> R2) via
// /api/admin/upload (itemType=card_deck), which names them deterministically:
//   games/tero/card_decks/{variant}/{variant}.webp
//   games/tero/card_decks/{variant}/{variant}.atlas.txt
// so the backend can build the URLs from the variant slug alone.
//
// This does NOT create a store_item — the purchasable deck items (carrying
// metadata.variant) already exist; this only replaces their card art.

type Slot = 'sprite' | 'atlas';

interface UploadState {
  status: 'idle' | 'uploading' | 'done' | 'error';
  publicUrl?: string;
  error?: string;
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

async function uploadOne(variant: string, file: File, contentType: string): Promise<string> {
  const fd = new FormData();
  fd.append('itemType', 'card_deck');
  fd.append('category', variant);
  // Re-wrap so the Content-Type is explicit (a .txt File can arrive with an
  // empty type, which the route would reject).
  fd.append('file', new File([file], file.name, { type: contentType }));

  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
  if (!data?.publicUrl) throw new Error('No publicUrl in response');
  return data.publicUrl as string;
}

export default function DeckAtlasUploader() {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState('space');
  const [sprite, setSprite] = useState<File | null>(null);
  const [atlas, setAtlas] = useState<File | null>(null);
  const [spriteState, setSpriteState] = useState<UploadState>({ status: 'idle' });
  const [atlasState, setAtlasState] = useState<UploadState>({ status: 'idle' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const spriteRef = useRef<HTMLInputElement>(null);
  const atlasRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setSprite(null);
    setAtlas(null);
    setSpriteState({ status: 'idle' });
    setAtlasState({ status: 'idle' });
    setError('');
  };

  function pick(slot: Slot, file: File | null) {
    if (!file) return;
    if (slot === 'sprite') {
      setSprite(file);
      setSpriteState({ status: 'idle' });
    } else {
      setAtlas(file);
      setAtlasState({ status: 'idle' });
    }
    setError('');
  }

  async function uploadAll() {
    const v = slugify(variant);
    if (!v) {
      setError('Variant slug is required (e.g. anime, noir, space).');
      return;
    }
    if (!sprite) {
      setError('Select the sprite sheet ({variant}.webp).');
      return;
    }
    if (!atlas) {
      setError('Select the atlas file ({variant}.atlas.txt).');
      return;
    }
    if (!sprite.name.toLowerCase().endsWith('.webp')) {
      setError('Sprite sheet must be a .webp file.');
      return;
    }
    if (!atlas.name.toLowerCase().endsWith('.txt')) {
      setError('Atlas must be a .txt file (e.g. space.atlas.txt).');
      return;
    }

    setBusy(true);
    setError('');
    try {
      setSpriteState({ status: 'uploading' });
      const spriteUrl = await uploadOne(v, sprite, 'image/webp');
      setSpriteState({ status: 'done', publicUrl: spriteUrl });
    } catch (e) {
      setSpriteState({ status: 'error', error: e instanceof Error ? e.message : 'failed' });
      setBusy(false);
      return;
    }
    try {
      setAtlasState({ status: 'uploading' });
      const atlasUrl = await uploadOne(v, atlas, 'text/plain');
      setAtlasState({ status: 'done', publicUrl: atlasUrl });
    } catch (e) {
      setAtlasState({ status: 'error', error: e instanceof Error ? e.message : 'failed' });
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
      >
        <Plus className="w-4 h-4" /> Upload deck sprite + atlas
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Upload Tero deck (sprite + atlas)</h3>
        <button
          onClick={() => { reset(); setOpen(false); }}
          className="text-xs text-slate-400 hover:text-slate-100"
        >Close</button>
      </div>
      <p className="text-xs text-slate-400">
        Uploads <code>{'{variant}'}.webp</code> + <code>{'{variant}'}.atlas.txt</code> straight to R2 at
        <code> games/tero/card_decks/{'{variant}'}/</code>. The variant&apos;s store item must already exist — this
        only replaces its card art.
      </p>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Variant slug</label>
        <input
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          placeholder="anime, noir, space, …"
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
        />
      </div>

      <FilePicker
        label="Sprite sheet (.webp)"
        file={sprite}
        state={spriteState}
        accept="image/webp,.webp"
        inputRef={spriteRef}
        onPick={(f) => pick('sprite', f)}
      />
      <FilePicker
        label="Atlas (.txt)"
        file={atlas}
        state={atlasState}
        accept="text/plain,.txt"
        inputRef={atlasRef}
        onPick={(f) => pick('atlas', f)}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={uploadAll}
          disabled={busy || !sprite || !atlas}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload both'}
        </button>
        <button
          onClick={reset}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm hover:bg-slate-600 disabled:opacity-50"
        >Reset</button>
      </div>
    </div>
  );
}

function FilePicker(props: {
  label: string;
  file: File | null;
  state: UploadState;
  accept: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (f: File | null) => void;
}) {
  const { label, file, state, accept, inputRef, onPick } = props;
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div
        className="rounded-lg border-2 border-dashed border-slate-600 p-3 text-center cursor-pointer hover:border-slate-500"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0] ?? null); }}
      >
        <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
        <p className="text-xs text-slate-300 break-all">{file ? file.name : 'Click or drop file'}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </div>
      {state.status === 'done' && (
        <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1 break-all">
          <CheckCircle2 className="w-3 h-3" /> {state.publicUrl}
        </p>
      )}
      {state.status === 'error' && (
        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {state.error}
        </p>
      )}
      {state.status === 'uploading' && <p className="mt-1 text-xs text-amber-400">uploading…</p>}
    </div>
  );
}
