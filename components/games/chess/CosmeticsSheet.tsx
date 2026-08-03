'use client';

import { useCallback } from 'react';
import { X } from 'lucide-react';

import type { GameApi } from '@/lib/kalpix-web-sdk/games';
import { CHESS_PIECE_NAMES } from '@/lib/kalpix-web-sdk/chess';
import { lobbyTheme } from '@/components/games/shell/theme';

import UpgradesTab from './lobby/UpgradesTab';

// In-match Customize sheet — the chess counterpart of Tero's in-game cosmetics
// sheet. Wraps the lobby's UpgradesTab rather than duplicating it, so buying
// and equipping behave identically in both places.
//
// The two cosmetic layers behave differently on equip, and that split is the
// whole reason this component exists:
//
//   pieces     — per-SIDE, so the opponent must be told. Goes through the
//                server (refresh_match_cosmetics), which re-reads the equipped
//                set and rebroadcasts match state. Capped server-side.
//   board /
//   background — per-VIEWER. Nobody else can see them, so they never touch the
//                match; the client just re-fetches its own cosmetics.

export interface CosmeticsSheetProps {
  games: GameApi;
  matchId: string;
  /** Re-fetch this viewer's own board/background after an equip. */
  onViewerCosmeticsChanged(): void;
  onClose(): void;
}

/**
 * Warm the browser cache for a piece set before it goes live.
 *
 * Board.tsx drives sprites from `background-image`, so swapping the base URL
 * on an un-cached set blanks up to sixteen squares while they download — on a
 * running clock. Decoding first makes the swap instant.
 */
async function preloadPieceSet(baseUrl: string): Promise<void> {
  if (!baseUrl) return;
  await Promise.all(
    CHESS_PIECE_NAMES.map(
      (name) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          // Resolve either way: a failed preload should never block the equip,
          // it just means that sprite paints a moment later.
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = `${baseUrl}/${name}.webp`;
        }),
    ),
  );
}

export default function CosmeticsSheet(p: CosmeticsSheetProps) {
  const handleEquipped = useCallback(
    async (subcategory: string, item: { assetUrl?: string; previewUrl?: string; metadata?: Record<string, string> }) => {
      if (subcategory === 'pieces') {
        const base = item.metadata?.baseUrl ?? '';
        await preloadPieceSet(base);
        try {
          await p.games.refreshMatchCosmetics(p.matchId);
        } catch {
          // Cap reached or the match ended — the equip itself still stuck and
          // applies to the next game. UpgradesTab surfaces the error text.
        }
        return;
      }
      // board / background are private to this viewer.
      p.onViewerCosmeticsChanged();
    },
    [p],
  );

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="text-lg font-semibold text-white">Customize</div>
        <button
          onClick={p.onClose}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>
      <div
        className="mt-2 flex-1 overflow-y-auto"
        style={{ background: lobbyTheme.bg }}
      >
        <UpgradesTab games={p.games} onEquipped={handleEquipped} />
      </div>
    </div>
  );
}
