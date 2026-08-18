'use client';

import Image from 'next/image';
import { ChevronLeft, Star } from 'lucide-react';
import { lobbyTheme } from '@/components/games/shell/theme';

/**
 * Ask the Flutter host to close the webview. No-op in a plain browser, where
 * the KalpixNative channel is absent.
 */
function closeWebview() {
  if (typeof window === 'undefined') return;
  const native = (window as unknown as {
    KalpixNative?: { postMessage: (msg: string) => void };
  }).KalpixNative;
  native?.postMessage?.(JSON.stringify({ action: 'close_webview' }));
}

export interface LobbyHeaderProps {
  title: string;
  bannerUrl?: string;
  rating: number;
  peakRating: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  gamesPlayed: number;
  rankLabel: string; // e.g. "Silver", "Gold", "Master"
  rankProgress: number; // 0..1 within current rank
}

export default function LobbyHeader(p: LobbyHeaderProps) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{ height: 240 }}
    >
      {p.bannerUrl ? (
        <Image
          src={p.bannerUrl}
          alt={p.title}
          fill
          className="object-cover"
          priority
          unoptimized
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${lobbyTheme.bgGrad1}, ${lobbyTheme.bgGrad2}, ${lobbyTheme.primary})`,
          }}
        />
      )}

      {/* Top→bottom dim gradient so text stays readable on any banner */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/85" />

      {/* Title */}
      <div className="absolute left-5 right-5 top-5 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          {/* The native host draws no title bar for webview games, so this is
              the only way out on iOS (which has no system back button). */}
          <button
            type="button"
            aria-label="Leave game"
            onClick={closeWebview}
            className="-ml-1 grid h-9 w-9 place-items-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/55"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-2xl font-semibold tracking-wide">{p.title}</div>
        </div>
        <div className="text-xs text-white/60">
          {p.gamesPlayed} games · {p.gamesWon}W / {p.gamesLost}L
          {p.gamesDrawn > 0 && ` / ${p.gamesDrawn}D`}
        </div>
      </div>

      {/* Bottom rank strip */}
      <div className="absolute inset-x-5 bottom-5 flex items-center gap-3">
        <Star className="h-7 w-7 text-yellow-300" />
        <div className="flex-1">
          <div
            className="h-3.5 w-full overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(0, Math.min(1, p.rankProgress)) * 100}%`,
                background: lobbyTheme.success,
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-white/85">
            <span>{p.rankLabel}</span>
            <span>
              Rating {p.rating}
              {p.peakRating > p.rating && (
                <span className="ml-2 text-white/45">peak {p.peakRating}</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
