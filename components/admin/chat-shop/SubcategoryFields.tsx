'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  AdminListItem,
  BackgroundAssets,
  BubbleStyleAssets,
  FontAssets,
  listItemsAdmin,
  PackAssets,
  PackItem,
  Subcategory,
  SyncAssetsEnvelope,
  ThemeAssets,
} from '@/lib/chat-shop-api';
import { AssetUploader } from './AssetUploader';

/**
 * Default factories: each subcategory's form needs a prefilled structure so
 * admins don't have to type zeros for required numeric fields.
 */

export function defaultAssetsFor(sub: Subcategory): SyncAssetsEnvelope {
  switch (sub) {
    case 'bubble_style':
      return {
        bubbleStyle: {
          sentImageUrl: '',
          sentCenterSlice: { x: 60, y: 40, w: 4, h: 4 },
          sentPadding: { t: 12, r: 48, b: 12, l: 20 },
          sentTextColor: '#FFFFFF',
          receivedImageUrl: '',
          receivedCenterSlice: { x: 60, y: 40, w: 4, h: 4 },
          receivedPadding: { t: 12, r: 20, b: 12, l: 48 },
          receivedTextColor: '#222222',
          timestampColor: '#FFFFFFB3',
          minBubbleWidthPx: 60,
        },
      };
    case 'background':
      return {
        background: {
          imageUrl: '',
          blurhash: '',
          widthPx: 1080,
          heightPx: 1920,
          tileable: false,
        },
      };
    case 'font':
      return {
        font: {
          fontFamily: '',
          fontFileUrl: '',
          supportedWeights: [400],
          fallbackFamily: 'sans-serif',
          licenseUrl: '',
        },
      };
    case 'theme':
      return {
        theme: { accentColor: '#FFFFFF' },
      };
    case 'sticker_pack':
    case 'gif_pack':
    case 'emote_pack':
      return {
        pack: { coverUrl: '', items: [] },
      };
  }
}

// ----------------------------------------------------------------------------
// Shared small utilities
// ----------------------------------------------------------------------------

function NumField({
  label,
  value,
  onChange,
  step = 1,
  className = 'w-20',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      <span className="w-10 text-slate-500">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${className} px-2 py-1 bg-slate-800 border border-slate-700 rounded`}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      <span className="w-32">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#RRGGBB"
        className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded font-mono text-slate-200"
      />
    </label>
  );
}

// ----------------------------------------------------------------------------
// Per-subcategory sections. Each owns its patch-immutable slice of the
// assets envelope and signals changes back to the parent.
// ----------------------------------------------------------------------------

export function BubbleStyleFields({
  value,
  onChange,
}: {
  value: BubbleStyleAssets;
  onChange: (next: BubbleStyleAssets) => void;
}) {
  const patch = (partial: Partial<BubbleStyleAssets>) => onChange({ ...value, ...partial });

  const RectInput = ({
    label,
    rect,
    onChange: onRectChange,
  }: {
    label: string;
    rect: { x: number; y: number; w: number; h: number };
    onChange: (r: { x: number; y: number; w: number; h: number }) => void;
  }) => (
    <div className="space-y-1">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex gap-2 flex-wrap">
        <NumField label="x" value={rect.x} onChange={(v) => onRectChange({ ...rect, x: v })} />
        <NumField label="y" value={rect.y} onChange={(v) => onRectChange({ ...rect, y: v })} />
        <NumField label="w" value={rect.w} onChange={(v) => onRectChange({ ...rect, w: v })} />
        <NumField label="h" value={rect.h} onChange={(v) => onRectChange({ ...rect, h: v })} />
      </div>
    </div>
  );

  const PadInput = ({
    label,
    pad,
    onChange: onPadChange,
  }: {
    label: string;
    pad: { t: number; r: number; b: number; l: number };
    onChange: (p: { t: number; r: number; b: number; l: number }) => void;
  }) => (
    <div className="space-y-1">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex gap-2 flex-wrap">
        <NumField label="t" value={pad.t} onChange={(v) => onPadChange({ ...pad, t: v })} />
        <NumField label="r" value={pad.r} onChange={(v) => onPadChange({ ...pad, r: v })} />
        <NumField label="b" value={pad.b} onChange={(v) => onPadChange({ ...pad, b: v })} />
        <NumField label="l" value={pad.l} onChange={(v) => onPadChange({ ...pad, l: v })} />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h4 className="text-sm font-medium text-slate-300">Sent (your bubble)</h4>
        <AssetUploader
          label="Sent image"
          value={value.sentImageUrl}
          onChange={(u) => patch({ sentImageUrl: u })}
          subcategory="bubble_style"
        />
        <RectInput
          label="Sent center-slice (px)"
          rect={value.sentCenterSlice}
          onChange={(r) => patch({ sentCenterSlice: r })}
        />
        <PadInput
          label="Sent padding (logical px)"
          pad={value.sentPadding}
          onChange={(p) => patch({ sentPadding: p })}
        />
        <ColorField label="Sent text color" value={value.sentTextColor} onChange={(v) => patch({ sentTextColor: v })} />
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-medium text-slate-300">Received (opponent&apos;s bubble)</h4>
        <AssetUploader
          label="Received image"
          value={value.receivedImageUrl}
          onChange={(u) => patch({ receivedImageUrl: u })}
          subcategory="bubble_style"
        />
        <RectInput
          label="Received center-slice (px)"
          rect={value.receivedCenterSlice}
          onChange={(r) => patch({ receivedCenterSlice: r })}
        />
        <PadInput
          label="Received padding"
          pad={value.receivedPadding}
          onChange={(p) => patch({ receivedPadding: p })}
        />
        <ColorField
          label="Received text color"
          value={value.receivedTextColor}
          onChange={(v) => patch({ receivedTextColor: v })}
        />
      </section>
      <section className="space-y-3 md:col-span-2 pt-3 border-t border-slate-800">
        <h4 className="text-sm font-medium text-slate-300">Shared</h4>
        <div className="flex flex-wrap gap-4">
          <ColorField
            label="Timestamp color"
            value={value.timestampColor}
            onChange={(v) => patch({ timestampColor: v })}
          />
          <NumField
            label="minW"
            value={value.minBubbleWidthPx}
            onChange={(v) => patch({ minBubbleWidthPx: v })}
            className="w-24"
          />
        </div>
      </section>
    </div>
  );
}

export function BackgroundFields({
  value,
  onChange,
}: {
  value: BackgroundAssets;
  onChange: (next: BackgroundAssets) => void;
}) {
  const patch = (partial: Partial<BackgroundAssets>) => onChange({ ...value, ...partial });
  return (
    <div className="space-y-4">
      <AssetUploader
        label="Background image"
        value={value.imageUrl}
        onChange={(u) => patch({ imageUrl: u })}
        subcategory="background"
      />
      <div className="flex flex-wrap gap-4">
        <NumField label="w" value={value.widthPx} onChange={(v) => patch({ widthPx: v })} className="w-24" />
        <NumField label="h" value={value.heightPx} onChange={(v) => patch({ heightPx: v })} className="w-24" />
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={value.tileable}
            onChange={(e) => patch({ tileable: e.target.checked })}
          />
          Tileable
        </label>
      </div>
      <TextField label="Blurhash (optional)" value={value.blurhash} onChange={(v) => patch({ blurhash: v })} />
    </div>
  );
}

export function FontFields({
  value,
  onChange,
}: {
  value: FontAssets;
  onChange: (next: FontAssets) => void;
}) {
  const patch = (partial: Partial<FontAssets>) => onChange({ ...value, ...partial });
  const weightsText = value.supportedWeights.join(',');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TextField
        label="Font family"
        value={value.fontFamily}
        onChange={(v) => patch({ fontFamily: v })}
        placeholder="Inter"
      />
      <TextField
        label="Fallback family"
        value={value.fallbackFamily}
        onChange={(v) => patch({ fallbackFamily: v })}
        placeholder="sans-serif"
      />
      <div className="md:col-span-2">
        <AssetUploader
          label="Font file (.ttf, .otf, .woff2)"
          value={value.fontFileUrl}
          onChange={(u) => patch({ fontFileUrl: u })}
          subcategory="font"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2,application/octet-stream"
          fileLabel="font"
        />
      </div>
      <TextField
        label="Supported weights (comma-separated)"
        value={weightsText}
        onChange={(v) =>
          patch({
            supportedWeights: v
              .split(',')
              .map((x) => Number(x.trim()))
              .filter((n) => Number.isFinite(n) && n > 0),
          })
        }
        placeholder="400,700"
      />
      <TextField label="License URL (optional)" value={value.licenseUrl} onChange={(v) => patch({ licenseUrl: v })} />
    </div>
  );
}

/**
 * Theme form — lets the admin pick the bundled component ids from the
 * already-published chat catalogue. Fetches options lazily on mount.
 */
export function ThemeFields({
  value,
  onChange,
}: {
  value: ThemeAssets;
  onChange: (next: ThemeAssets) => void;
}) {
  const patch = (partial: Partial<ThemeAssets>) => onChange({ ...value, ...partial });
  const [bubbles, setBubbles] = useState<AdminListItem[]>([]);
  const [bgs, setBgs] = useState<AdminListItem[]>([]);
  const [fonts, setFonts] = useState<AdminListItem[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [b, g, f] = await Promise.all([
          listItemsAdmin({ subcategory: 'bubble_style', limit: 200 }),
          listItemsAdmin({ subcategory: 'background', limit: 200 }),
          listItemsAdmin({ subcategory: 'font', limit: 200 }),
        ]);
        setBubbles(b.items);
        setBgs(g.items);
        setFonts(f.items);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load components');
      }
    })();
  }, []);

  const Select = ({
    label,
    value: current,
    options,
    onChange: onPick,
  }: {
    label: string;
    value: string | undefined;
    options: AdminListItem[];
    onChange: (id: string | undefined) => void;
  }) => (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      <span>{label}</span>
      <select
        value={current || ''}
        onChange={(e) => onPick(e.target.value || undefined)}
        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200"
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o.itemId} value={o.itemId}>
            {o.name} ({o.slug}) [{o.status}]
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-3">
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Bubble style"
          value={value.bubbleStyleId}
          options={bubbles}
          onChange={(id) => patch({ bubbleStyleId: id })}
        />
        <Select
          label="Background"
          value={value.backgroundId}
          options={bgs}
          onChange={(id) => patch({ backgroundId: id })}
        />
        <Select label="Font" value={value.fontId} options={fonts} onChange={(id) => patch({ fontId: id })} />
      </div>
      <ColorField
        label="Accent color"
        value={value.accentColor}
        onChange={(v) => patch({ accentColor: v })}
      />
      <p className="text-xs text-slate-500">
        On purchase, theme ownership is exploded into each non-null component automatically
        (source=&apos;theme_bundle&apos;). Users can use any bundled component standalone after owning the theme.
      </p>
    </div>
  );
}

/**
 * Pack fields — shared widget for sticker_pack / gif_pack / emote_pack.
 * kind is used to pick the right uploader label + whether shortcode/previewUrl
 * columns are shown.
 */
export function PackFields({
  value,
  onChange,
  kind,
}: {
  value: PackAssets;
  onChange: (next: PackAssets) => void;
  kind: 'sticker_pack' | 'gif_pack' | 'emote_pack';
}) {
  const items = value.items ?? [];
  const patch = (partial: Partial<PackAssets>) => onChange({ ...value, ...partial });
  const patchItem = (i: number, partial: Partial<PackItem>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...partial } : it));
    patch({ items: next });
  };
  const removeItem = (i: number) => patch({ items: items.filter((_, idx) => idx !== i) });
  const addItem = () =>
    patch({
      items: [
        ...items,
        { mediaUrl: '', previewUrl: '', shortcode: '', tags: [], sortOrder: (items[items.length - 1]?.sortOrder ?? 0) + 1 },
      ],
    });

  const mediaFileLabel = kind === 'gif_pack' ? 'gif' : 'sticker';
  const accept =
    kind === 'gif_pack'
      ? 'image/gif,image/webp,image/png'
      : 'image/webp,image/png,image/jpeg,image/gif';

  return (
    <div className="space-y-4">
      <AssetUploader
        label="Pack cover"
        value={value.coverUrl}
        onChange={(u) => patch({ coverUrl: u })}
        subcategory={kind}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-300">
            Items ({items.length})
          </h4>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
          >
            <Plus className="w-3 h-3" /> Add item
          </button>
        </div>
        {items.length === 0 && (
          <p className="text-xs text-slate-500 italic">
            No items yet. Items sync replaces the full pack on the server — use carefully when editing a published pack.
          </p>
        )}
        <div className="space-y-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="p-3 border border-slate-800 rounded space-y-2 bg-slate-900/40"
            >
              <div className="flex items-start justify-between gap-3">
                <AssetUploader
                  label={`#${i + 1} ${mediaFileLabel}`}
                  value={it.mediaUrl}
                  onChange={(u) => patchItem(i, { mediaUrl: u })}
                  subcategory={kind}
                  accept={accept}
                  fileLabel={mediaFileLabel}
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="text-slate-500 hover:text-red-400 mt-5"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {kind === 'gif_pack' && (
                  <div className="flex-1 min-w-[240px]">
                    <TextField
                      label="Preview URL (optional, static)"
                      value={it.previewUrl || ''}
                      onChange={(v) => patchItem(i, { previewUrl: v })}
                    />
                  </div>
                )}
                {kind === 'emote_pack' && (
                  <div className="flex-1 min-w-[240px]">
                    <TextField
                      label="Shortcode (e.g. :kalpix_smile:)"
                      value={it.shortcode || ''}
                      onChange={(v) => patchItem(i, { shortcode: v })}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-[200px]">
                  <TextField
                    label="Tags (comma-separated)"
                    value={it.tags.join(',')}
                    onChange={(v) =>
                      patchItem(i, {
                        tags: v
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
                <NumField
                  label="sort"
                  value={it.sortOrder}
                  onChange={(v) => patchItem(i, { sortOrder: v })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
