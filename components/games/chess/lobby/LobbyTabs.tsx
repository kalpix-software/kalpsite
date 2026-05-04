'use client';

import { lobbyTheme } from '@/components/games/shell/theme';

export type LobbyTab = 'arena' | 'rank' | 'rules' | 'upgrades';

const TABS: { key: LobbyTab; label: string }[] = [
  { key: 'arena', label: 'Arena' },
  { key: 'rank', label: 'Rank' },
  { key: 'rules', label: 'Rules' },
  { key: 'upgrades', label: 'Upgrades' },
];

export default function LobbyTabs({
  active,
  onChange,
}: {
  active: LobbyTab;
  onChange: (t: LobbyTab) => void;
}) {
  return (
    <div
      className="sticky top-0 z-10 flex w-full backdrop-blur"
      style={{ background: 'rgba(11,15,28,0.85)' }}
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="relative flex-1 px-2 py-3 text-sm font-medium transition-colors"
            style={{
              color: isActive ? lobbyTheme.primary : lobbyTheme.textMuted,
            }}
          >
            {t.label}
            <span
              className="absolute inset-x-3 bottom-0 h-[2px] transition-opacity"
              style={{
                opacity: isActive ? 1 : 0,
                background: `linear-gradient(90deg, transparent, ${lobbyTheme.primary}, transparent)`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
