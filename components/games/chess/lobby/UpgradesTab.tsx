'use client';

import { Sparkles } from 'lucide-react';
import { lobbyTheme } from '@/components/games/shell/theme';

export default function UpgradesTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 pb-32 pt-24 text-center">
      <Sparkles className="h-10 w-10" style={{ color: lobbyTheme.textDim }} />
      <div className="text-lg font-semibold text-white">Upgrades coming soon</div>
      <div className="max-w-sm text-sm" style={{ color: lobbyTheme.textMuted }}>
        Board themes, piece sets, and sound packs will appear here. Equip them
        from the store to customize your matches.
      </div>
    </div>
  );
}
