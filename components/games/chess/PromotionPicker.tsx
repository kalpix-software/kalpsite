'use client';

import type { ChessSide } from '@/lib/kalpix-web-sdk/chess';

export interface PromotionPickerProps {
  side: ChessSide;
  onPick(piece: 'q' | 'r' | 'b' | 'n'): void;
  onCancel(): void;
}

const pieces: Array<{ key: 'q' | 'r' | 'b' | 'n'; glyphWhite: string; glyphBlack: string; label: string }> = [
  { key: 'q', glyphWhite: '♕', glyphBlack: '♛', label: 'Queen' },
  { key: 'r', glyphWhite: '♖', glyphBlack: '♜', label: 'Rook' },
  { key: 'b', glyphWhite: '♗', glyphBlack: '♝', label: 'Bishop' },
  { key: 'n', glyphWhite: '♘', glyphBlack: '♞', label: 'Knight' },
];

export default function PromotionPicker(p: PromotionPickerProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
      <div className="rounded-lg bg-zinc-900 p-4 shadow-2xl">
        <div className="mb-3 text-center text-sm uppercase tracking-wider text-white/60">
          Promote to
        </div>
        <div className="flex gap-3">
          {pieces.map((piece) => (
            <button
              key={piece.key}
              onClick={() => p.onPick(piece.key)}
              className="flex h-20 w-20 flex-col items-center justify-center rounded-md bg-white/5 text-5xl text-white transition hover:bg-white/15"
              aria-label={piece.label}
            >
              <span>{p.side === 'white' ? piece.glyphWhite : piece.glyphBlack}</span>
            </button>
          ))}
        </div>
        <button
          onClick={p.onCancel}
          className="mt-4 w-full rounded-md py-2 text-sm text-white/50 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
