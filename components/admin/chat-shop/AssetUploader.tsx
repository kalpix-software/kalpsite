'use client';

import { useRef, useState } from 'react';
import { uploadChatAsset, Subcategory } from '@/lib/chat-shop-api';

/**
 * Small uploader used by the chat-shop forms. Accepts either raster image
 * types or (optionally) a font file. Hands a public CDN URL back to the
 * caller via onChange.
 */
export function AssetUploader({
  label,
  value,
  onChange,
  subcategory,
  accept = 'image/webp,image/png,image/jpeg,image/gif',
  fileLabel = 'image',
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  subcategory: Subcategory;
  accept?: string;
  fileLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const handle = async (file: File) => {
    setUploading(true);
    setErr('');
    try {
      const { publicUrl } = await uploadChatAsset(file, subcategory);
      onChange(publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const isImage = accept.startsWith('image/');

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-300">{label}</label>
      <div className="flex items-center gap-3">
        {value && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="preview"
            className="h-16 w-16 object-cover rounded border border-slate-600 flex-shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded border border-dashed border-slate-500 flex items-center justify-center text-slate-500 text-xs flex-shrink-0">
            {fileLabel}
          </div>
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 w-max"
          >
            {uploading ? 'Uploading…' : value ? 'Replace' : `Upload ${fileLabel}`}
          </button>
          {value && (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-500 truncate max-w-[320px] underline-offset-2 hover:underline"
            >
              {value.split('/').pop()}
            </a>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handle(file);
          e.target.value = '';
        }}
      />
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
