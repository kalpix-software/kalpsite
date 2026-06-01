'use client';

import { useEffect, useState } from 'react';
import { Crown, Medal, User as UserIcon, Users } from 'lucide-react';

import type { GameApi, LeaderboardEntry } from '@/lib/kalpix-web-sdk/games';
import { lobbyTheme } from '@/components/games/shell/theme';

export default function RankTab({
  games,
  myUserId,
}: {
  games: GameApi;
  myUserId: string;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    games
      .getLeaderboard({ gameId: 'chess', limit: 50 })
      .then((r) => {
        if (cancelled) return;
        setEntries(r.entries ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [games]);

  return (
    <div className="flex flex-col gap-3 px-5 pb-32 pt-4">
      {error && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'rgba(229,72,77,0.15)', color: lobbyTheme.danger }}
        >
          {error}
        </div>
      )}

      {entries === null && !error && <RankSkeleton />}

      {entries && entries.length === 0 && (
        <div
          className="grid place-items-center rounded-xl py-12 text-center"
          style={{ background: lobbyTheme.cardSoft }}
        >
          <Users className="mb-2 h-7 w-7" style={{ color: lobbyTheme.textDim }} />
          <div style={{ color: lobbyTheme.textMuted }}>
            No entries yet. Play a rated game to appear on the board.
          </div>
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <RankRow key={`${e.userId}-${e.rank}`} e={e} isMe={e.userId === myUserId} />
          ))}
        </div>
      )}
    </div>
  );
}

function RankRow({ e, isMe }: { e: LeaderboardEntry; isMe: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2"
      style={{
        background: isMe ? lobbyTheme.primarySoft : lobbyTheme.cardSoft,
        border: isMe ? `1px solid ${lobbyTheme.primaryBorder}` : '1px solid transparent',
      }}
    >
      <div className="grid h-9 w-9 place-items-center">
        {e.rank === 1 ? (
          <Crown className="h-6 w-6 text-yellow-300" />
        ) : e.rank === 2 ? (
          <Medal className="h-5 w-5 text-zinc-300" />
        ) : e.rank === 3 ? (
          <Medal className="h-5 w-5 text-orange-400" />
        ) : (
          <span className="text-sm font-mono" style={{ color: lobbyTheme.textMuted }}>
            {e.rank}
          </span>
        )}
      </div>

      <div
        className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        {e.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={e.avatarUrl} alt={e.username} className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-5 w-5 text-white/50" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="truncate font-medium text-white">
            {e.displayName || e.username}
          </span>
          {isMe && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{ background: lobbyTheme.primary, color: '#fff' }}
            >
              You
            </span>
          )}
        </div>
        <div className="truncate text-xs" style={{ color: lobbyTheme.textDim }}>
          @{e.username}
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm font-semibold text-white">{e.score}</div>
        <div className="text-xs" style={{ color: lobbyTheme.textDim }}>
          Rating · {e.numScore} games
        </div>
      </div>
    </div>
  );
}

function RankSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-xl"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
            backgroundSize: '200% 100%',
            animation: 'kalpix-shimmer 1.4s linear infinite',
          }}
        />
      ))}
      <style jsx>{`
        @keyframes kalpix-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
