'use client';

import { Crown, Plus } from 'lucide-react';
import { lobbyTheme } from '@/components/games/shell/theme';

export default function CreatePrivateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-white/5"
    >
      <div
        className="relative grid h-12 w-12 place-items-center rounded-xl"
        style={{ background: lobbyTheme.card }}
      >
        <Crown className="h-6 w-6 text-yellow-300" />
        <span
          className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full"
          style={{ background: lobbyTheme.primary }}
        >
          <Plus className="h-3.5 w-3.5 text-white" />
        </span>
      </div>
      <div>
        <div className="text-base font-semibold text-white">
          Create Private Game
        </div>
        <div className="text-xs" style={{ color: lobbyTheme.textMuted }}>
          Invite a friend or play with a bot
        </div>
      </div>
    </button>
  );
}
