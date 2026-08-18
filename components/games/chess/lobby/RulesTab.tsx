'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import type { GameApi, RulesResponse } from '@/lib/kalpix-web-sdk/games';
import { lobbyTheme } from '@/components/games/shell/theme';

const FALLBACK_RULES: RulesResponse = {
  gameId: 'chess',
  title: 'Chess',
  overview:
    'Two players, one board, sixteen pieces each. Checkmate the opposing king to win.',
  sections: [
    {
      title: 'Objective',
      content:
        'Place the opposing king under attack such that it has no legal move (checkmate).',
    },
    {
      title: 'Time Control',
      content:
        'Each player has a clock. Run out of time and you lose, unless your opponent has no way to checkmate — then it is a draw.',
    },
    {
      title: 'Draws',
      content:
        'Stalemate, threefold repetition, the fifty-move rule, agreement, and insufficient material all draw the game.',
    },
  ],
  quickTips: [
    'Develop knights and bishops before moving the queen.',
    'Castle early to keep the king safe.',
    'Control the center with pawns and pieces.',
    'Trade pieces when ahead in material; avoid trades when behind.',
  ],
};

export default function RulesTab({ games }: { games: GameApi }) {
  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    let cancelled = false;
    games
      .getRules('chess')
      .then((r) => {
        if (cancelled) return;
        // Backend may return an empty doc until rules are seeded — fall back.
        if (!r.title || (r.sections ?? []).length === 0) {
          setRules(FALLBACK_RULES);
        } else {
          setRules(r);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRules(FALLBACK_RULES);
      });
    return () => {
      cancelled = true;
    };
  }, [games]);

  if (!rules) {
    return (
      <div className="px-5 py-12 text-center" style={{ color: lobbyTheme.textMuted }}>
        Loading rules…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-32 pt-5">
      <div>
        <div className="text-2xl font-semibold text-white">{rules.title}</div>
        <div className="mt-2 text-sm leading-relaxed" style={{ color: lobbyTheme.textMuted }}>
          {rules.overview}
        </div>
      </div>

      <div className="h-px" style={{ background: lobbyTheme.divider }} />

      <div className="flex flex-col gap-2">
        {rules.sections.map((s, i) => {
          const isOpen = open.has(i);
          return (
            <div
              key={i}
              className="overflow-hidden rounded-xl"
              style={{ background: lobbyTheme.cardSoft }}
            >
              <button
                onClick={() =>
                  setOpen((prev) => {
                    const n = new Set(prev);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white"
              >
                <span>{s.title}</span>
                <ChevronDown
                  className="h-4 w-4 transition-transform duration-200"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}
                />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-200"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div
                    className="px-4 pb-4 text-sm leading-relaxed"
                    style={{ color: lobbyTheme.textMuted }}
                  >
                    {s.content}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rules.quickTips.length > 0 && (
        <>
          <div className="text-lg font-semibold text-white">Quick Tips</div>
          <ul className="flex flex-col gap-2">
            {rules.quickTips.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: lobbyTheme.primary }}
                />
                <span style={{ color: lobbyTheme.textMuted }}>{t}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
