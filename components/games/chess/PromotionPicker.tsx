'use client';

import { chessPieceUrl, type ChessSide } from '@/lib/kalpix-web-sdk/chess';

export interface PromotionPickerProps {
  side: ChessSide;
  /**
   * Sprite folder for the promoting player's equipped set — the same value the
   * board renders that side's pieces from. Undefined falls back to the Unicode
   * glyphs, so the picker still works if cosmetics failed to resolve.
   */
  pieceSetBaseUrl?: string;
  onPick(piece: 'q' | 'r' | 'b' | 'n'): void;
  onCancel(): void;
}

// FEN letters, because chessPieceUrl derives the sprite name from the raw
// character: uppercase = white, lowercase = black.
const pieces: Array<{
  key: 'q' | 'r' | 'b' | 'n';
  fen: string;
  glyphWhite: string;
  glyphBlack: string;
  label: string;
}> = [
  { key: 'q', fen: 'Q', glyphWhite: '♕', glyphBlack: '♛', label: 'Queen' },
  { key: 'r', fen: 'R', glyphWhite: '♖', glyphBlack: '♜', label: 'Rook' },
  { key: 'b', fen: 'B', glyphWhite: '♗', glyphBlack: '♝', label: 'Bishop' },
  { key: 'n', fen: 'N', glyphWhite: '♘', glyphBlack: '♞', label: 'Knight' },
];

export default function PromotionPicker(p: PromotionPickerProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
      <div className="rounded-lg bg-zinc-900 p-4 shadow-2xl">
        <div className="mb-3 text-center text-sm uppercase tracking-wider text-white/60">
          Promote to
        </div>
        <div className="flex gap-3">
          {pieces.map((piece) => {
            // Match the board's case convention so the sprite comes from the
            // promoting player's own set, not a hardcoded default.
            const fenChar = p.side === 'white' ? piece.fen : piece.fen.toLowerCase();
            const url = chessPieceUrl(p.pieceSetBaseUrl, fenChar);
            return (
              <button
                key={piece.key}
                onClick={() => p.onPick(piece.key)}
                className="flex h-20 w-20 flex-col items-center justify-center rounded-md bg-white/5 text-5xl text-white transition hover:bg-white/15"
                aria-label={piece.label}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={piece.label}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <span>{p.side === 'white' ? piece.glyphWhite : piece.glyphBlack}</span>
                )}
              </button>
            );
          })}
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
