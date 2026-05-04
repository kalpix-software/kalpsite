'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { KalpixClient, resolveRuntimeHost } from '@/lib/kalpix-web-sdk';
import {
  GameApi,
  type ActiveMatchSummary,
  type GameCatalogItem,
  type PlayerStatsResponse,
} from '@/lib/kalpix-web-sdk/games';
import { lobbyTheme } from '@/components/games/shell/theme';

import LobbyHeader from './LobbyHeader';
import LobbyTabs, { type LobbyTab } from './LobbyTabs';
import ArenaTab, { type QueueMode } from './ArenaTab';
import RankTab from './RankTab';
import RulesTab from './RulesTab';
import UpgradesTab from './UpgradesTab';
import CreatePrivateDialog from './CreatePrivateDialog';
import MatchmakingDialog from './MatchmakingDialog';
import ActiveMatchBar from './ActiveMatchBar';

// Host is resolved at runtime (URL query → sessionStorage → env) so the
// same kalpsite build serves both real-device and emulator from one server.

const DEFAULT_STATS: PlayerStatsResponse = {
  userId: '',
  gameId: 'chess',
  totalMatches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  winRate: 0,
  totalScore: 0,
  highestScore: 0,
  currentStreak: 0,
  longestWinStreak: 0,
  rank: 0,
  lastPlayedAt: 0,
  createdAt: 0,
  updatedAt: 0,
  gameSpecific: { rating: 1200, peakRating: 1200 },
};

export default function ChessLobbyClient() {
  const router = useRouter();
  const [tab, setTab] = useState<LobbyTab>('arena');
  const [bootError, setBootError] = useState<string | null>(null);

  const [catalogItem, setCatalogItem] = useState<GameCatalogItem | null>(null);
  const [stats, setStats] = useState<PlayerStatsResponse>(DEFAULT_STATS);
  const [activeMatches, setActiveMatches] = useState<ActiveMatchSummary[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [mmTimeControl, setMmTimeControl] = useState<'blitz' | 'rapid' | null>(null);

  const clientRef = useRef<KalpixClient | null>(null);
  const gamesRef = useRef<GameApi | null>(null);

  // Boot: client + initial fetches.
  useEffect(() => {
    let cancelled = false;
    const { host, ssl } = resolveRuntimeHost();
    const client = new KalpixClient({
      config: { host, ssl },
    });
    clientRef.current = client;
    gamesRef.current = new GameApi(client.http);

    const games = gamesRef.current;

    (async () => {
      // 1. Resolve session: URL fragment first (set in constructor),
      //    sessionStorage dev cache, then `kalpix_session` JS handler.
      const session = await client.bootstrapSession();
      if (cancelled) return;
      if (!session?.token) {
        setBootError('No session. Open this page from the Plazy app.');
        return;
      }

      // 2. Connect socket in the background — lobby still works without it.
      client.connect().catch((e) => {
        console.warn('socket connect failed:', e);
      });

      // 3. Fan out the lobby's data fetches.
      const [catalogR, statsR, activeR] = await Promise.allSettled([
        games.getCatalog(),
        games.getPlayerStats('chess').catch(() => DEFAULT_STATS),
        games.getActiveMatch('chess').catch(() => ({ active: false, matches: [] })),
      ]);
      if (cancelled) return;
      if (catalogR.status === 'fulfilled') {
        const chess = catalogR.value.games.find(
          (g) => g.gameId === 'chess' || (g as unknown as { slug?: string }).slug === 'chess',
        );
        if (chess) setCatalogItem(chess);
      }
      if (statsR.status === 'fulfilled') setStats(statsR.value ?? DEFAULT_STATS);
      if (activeR.status === 'fulfilled') setActiveMatches(activeR.value.matches ?? []);
    })();

    return () => {
      cancelled = true;
      client.dispose();
      clientRef.current = null;
      gamesRef.current = null;
    };
  }, []);

  const queues: QueueMode[] = useMemo(() => {
    const fromCatalog = (catalogItem?.modeConfigs ?? [])
      .filter((m) => m.key === 'blitz' || m.key === 'rapid')
      .map((m) => ({
        key: m.key as 'blitz' | 'rapid',
        title: m.displayName || (m.key === 'blitz' ? 'Blitz 5+0' : 'Rapid 10+0'),
        subtitle: m.subtitle ?? '1v1 · rated',
      }));
    return fromCatalog.length > 0 ? fromCatalog : undefined!;
  }, [catalogItem]);

  const rating = useMemo<number>(() => {
    const gs = stats.gameSpecific as { rating?: number } | undefined;
    return gs?.rating ?? 1200;
  }, [stats]);

  const peakRating = useMemo<number>(() => {
    const gs = stats.gameSpecific as { peakRating?: number } | undefined;
    return gs?.peakRating ?? rating;
  }, [stats, rating]);

  const startMatchmaking = useCallback((q: QueueMode) => {
    setMmTimeControl(q.key);
  }, []);

  const onMatchReady = useCallback(
    (matchId: string) => {
      setMmTimeControl(null);
      setCreateOpen(false);
      router.push(`/games/chess/match/${encodeURIComponent(matchId)}`);
    },
    [router],
  );

  // ── Render ───────────────────────────────────────────────────────────

  if (bootError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-zinc-950 p-8 text-center text-white">
        <div>
          <div className="text-xl font-semibold">Lobby unavailable</div>
          <div className="mt-2 text-sm text-white/60">{bootError}</div>
        </div>
      </div>
    );
  }

  const myUserId = clientRef.current?.session.current?.userId ?? '';
  const games = gamesRef.current!;

  return (
    <div
      className="relative min-h-dvh"
      style={{
        background: `linear-gradient(180deg, ${lobbyTheme.bgGrad1}, ${lobbyTheme.bgGrad2} 50%, ${lobbyTheme.bgGrad3})`,
      }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 pt-3">
        <button
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold text-white">Chess</div>
      </div>

      {/* Banner / rank strip */}
      <div className="px-3 pt-3">
        <LobbyHeader
          title={catalogItem?.name ?? 'Chess'}
          bannerUrl={catalogItem?.bannerUrl}
          rating={rating}
          peakRating={peakRating}
          wins={stats.wins}
          losses={stats.losses}
          draws={stats.draws}
          totalMatches={stats.totalMatches}
          rankLabel={ratingTitle(rating)}
          rankProgress={ratingProgress(rating)}
        />
      </div>

      <div className="mt-3">
        <LobbyTabs active={tab} onChange={setTab} />
      </div>

      {tab === 'arena' && (
        <ArenaTab
          queues={queues}
          onCreatePrivate={() => setCreateOpen(true)}
          onJoinQueue={startMatchmaking}
        />
      )}
      {tab === 'rank' && games && <RankTab games={games} myUserId={myUserId} />}
      {tab === 'rules' && games && <RulesTab games={games} />}
      {tab === 'upgrades' && <UpgradesTab />}

      <ActiveMatchBar
        matches={activeMatches}
        onResume={(id) => router.push(`/games/chess/match/${encodeURIComponent(id)}`)}
      />

      {createOpen && (
        <CreatePrivateDialog
          games={games}
          onClose={() => setCreateOpen(false)}
          onMatchReady={onMatchReady}
        />
      )}

      {mmTimeControl && clientRef.current && (
        <MatchmakingDialog
          client={clientRef.current}
          games={games}
          timeControl={mmTimeControl}
          rating={rating}
          onClose={() => setMmTimeControl(null)}
          onMatchReady={onMatchReady}
        />
      )}
    </div>
  );
}

function ratingTitle(rating: number): string {
  if (rating < 1000) return 'Pawn';
  if (rating < 1200) return 'Rook';
  if (rating < 1400) return 'Knight';
  if (rating < 1700) return 'Bishop';
  if (rating < 2000) return 'Queen';
  return 'King';
}

function ratingProgress(rating: number): number {
  // Map rating into 0..1 within the current band defined by ratingTitle.
  const bands = [0, 1000, 1200, 1400, 1700, 2000, 2400];
  for (let i = 0; i < bands.length - 1; i++) {
    if (rating < bands[i + 1]) {
      return (rating - bands[i]) / (bands[i + 1] - bands[i]);
    }
  }
  return 1;
}
