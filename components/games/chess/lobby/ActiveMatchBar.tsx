'use client';

import { ChevronRight, Users } from 'lucide-react';
import { lobbyTheme } from '@/components/games/shell/theme';
import type { ActiveMatchSummary } from '@/lib/kalpix-web-sdk/games';

export default function ActiveMatchBar({
  matches,
  onResume,
}: {
  matches: ActiveMatchSummary[];
  onResume(matchId: string): void;
}) {
  if (matches.length === 0) return null;
  // POC: show the most recent one. Multi-match carousel can land later.
  const m = matches[0];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
      style={{ background: 'rgba(11,15,28,0.92)', borderTop: `1px solid ${lobbyTheme.divider}` }}
    >
      <button
        onClick={() => onResume(m.matchId)}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left shadow-lg"
        style={{ background: lobbyTheme.primary }}
      >
        <div
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <Users className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {m.label || 'Resume your match'}
          </div>
          <div className="truncate text-xs text-white/70">
            {m.playingCount} playing · {m.matchType}
          </div>
        </div>
        <span className="text-sm font-semibold text-white">Rejoin</span>
        <ChevronRight className="h-4 w-4 text-white" />
      </button>
    </div>
  );
}
