'use client';

import { Crown } from 'lucide-react';
import { lobbyTheme } from '@/components/games/shell/theme';

export interface QueueRowProps {
  title: string;
  subtitle: string;
  borderColor: string;
  onJoin: () => void;
}

export default function QueueRow(p: QueueRowProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border-2 p-3"
      style={{
        background: lobbyTheme.card,
        borderColor: p.borderColor,
      }}
    >
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
        style={{ background: `${p.borderColor}33` }}
      >
        <Crown className="h-5 w-5" style={{ color: p.borderColor }} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">
          {p.title}
        </div>
        <div className="truncate text-xs" style={{ color: lobbyTheme.textMuted }}>
          {p.subtitle}
        </div>
      </div>

      <button
        onClick={p.onJoin}
        className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
        style={{ background: lobbyTheme.primary }}
      >
        Join
      </button>
    </div>
  );
}
