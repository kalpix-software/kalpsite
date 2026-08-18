'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { ChevronLeft, ChevronRight, Loader2, Play, Pause, SkipBack, SkipForward } from 'lucide-react';

import { useRouter } from 'next/navigation';

import { KalpixClient, resolveRuntimeHost } from '@/lib/kalpix-web-sdk';
import { GameApi, type MatchReplayResponse } from '@/lib/kalpix-web-sdk/games';
import type { ChessSide } from '@/lib/kalpix-web-sdk/chess';

import Board from './Board';
import BackButton from '@/components/games/shell/BackButton';
import { useNativeBack } from '@/hooks/useNativeBack';

// Read-only replay of a finished chess game.
//
// Deliberately has NO socket and NO polling: the match is long gone by the time
// anyone opens this, so everything comes from one game/get_match_replay call.
// The board is reused as-is — it is already replay-safe with interactive=false
// and mySide=null (no drag handlers bind, no legal-move computation runs).
//
// Positions are derived by replaying the UCI move list through chess.js from
// the start position, which is why the backend stores UCI rather than SAN:
// each move applies without needing board context to disambiguate.

const AUTOPLAY_MS = 900;

export default function ChessReplayClient({ matchId }: { matchId: string }) {
  const router = useRouter();

  // Replay had neither an on-screen back nor a native-back handler, so the
  // hardware button dropped straight out of the webview to the games catalog
  // and iOS had no way out at all. Both now step to the lobby.
  useNativeBack(() => {
    router.push('/games/chess/lobby');
    return true;
  });

  const [replay, setReplay] = useState<MatchReplayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const clientRef = useRef<KalpixClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { host, ssl } = resolveRuntimeHost();
    const client = new KalpixClient({ config: { host, ssl } });
    clientRef.current = client;

    (async () => {
      try {
        const session = await client.bootstrapSession();
        if (cancelled) return;
        if (!session?.token) {
          setError('No session. Open this page from the Plak app.');
          return;
        }
        const r = await new GameApi(client.http).getMatchReplay(matchId);
        if (!cancelled) setReplay(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      client.dispose();
      clientRef.current = null;
    };
  }, [matchId]);

  const chess = replay?.chess;

  // Every position from start to end, computed once. Cheap for a chess game
  // (a long one is ~150 plies) and it makes scrubbing instant.
  const positions = useMemo<string[]>(() => {
    if (!chess) return [];
    const game = new Chess();
    const fens = [game.fen()];
    for (const uci of chess.moves) {
      try {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        game.move({ from, to, promotion });
        fens.push(game.fen());
      } catch {
        // A move we can't apply means the rest can't be trusted either;
        // stop here rather than showing a corrupted board.
        break;
      }
    }
    return fens;
  }, [chess]);

  const maxPly = Math.max(0, positions.length - 1);

  useEffect(() => {
    if (!playing) return;
    if (ply >= maxPly) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setPly((p) => Math.min(maxPly, p + 1)), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [playing, ply, maxPly]);

  const step = useCallback((delta: number) => {
    setPlaying(false);
    setPly((p) => Math.max(0, Math.min(maxPly, p + delta)));
  }, [maxPly]);

  if (error) {
    return <Centered title="Replay unavailable" detail={error} />;
  }
  if (!replay) {
    return (
      <div className="grid min-h-dvh place-items-center bg-zinc-950 text-white">
        <Loader2 className="h-7 w-7 animate-spin text-white/40" />
      </div>
    );
  }
  if (!replay.available) {
    // Expected, not an error: only the most recent matches per game are kept.
    return (
      <Centered
        title="Replay no longer available"
        detail="Only your most recent games are kept. This one has since been replaced."
      />
    );
  }
  if (!chess || positions.length === 0) {
    return <Centered title="No replay data" detail="This match was recorded before replays were saved." />;
  }

  const lastMove = ply > 0 ? chess.moves[ply - 1] : undefined;
  const turn: ChessSide = ply % 2 === 0 ? 'white' : 'black';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between gap-3 px-4 pt-3 text-sm">
        <BackButton onBack={() => router.push('/games/chess/lobby')} label="Back to lobby" />
        <Seat name={chess.black?.username ?? 'Black'} rating={chess.black?.rating} avatarUrl={chess.black?.avatarUrl} />
        <div className="text-xs text-white/40">{chess.timeControl}</div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2">
        <Board
          fen={positions[ply]}
          orientation="white"
          turn={turn}
          mySide={null}
          lastMove={lastMove}
          interactive={false}
          onMove={() => {}}
          onPromotionNeeded={() => {}}
          whitePieceSetBaseUrl={chess.white?.pieceSetBaseUrl}
          blackPieceSetBaseUrl={chess.black?.pieceSetBaseUrl}
        />
      </div>

      <footer className="flex flex-col gap-3 px-4 pb-4">
        <Seat name={chess.white?.username ?? 'White'} rating={chess.white?.rating} avatarUrl={chess.white?.avatarUrl} />

        <div className="text-center text-sm">
          <span className="font-semibold">{resultLabel(chess.result)}</span>
          {chess.reason && <span className="text-white/50"> · {chess.reason}</span>}
        </div>

        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={maxPly}
          value={ply}
          onChange={(e) => { setPlaying(false); setPly(Number(e.target.value)); }}
          className="w-full accent-emerald-500"
          aria-label="Move"
        />

        <div className="flex items-center justify-center gap-2">
          <CtrlButton onClick={() => { setPlaying(false); setPly(0); }} label="Start"><SkipBack className="h-4 w-4" /></CtrlButton>
          <CtrlButton onClick={() => step(-1)} label="Previous"><ChevronLeft className="h-4 w-4" /></CtrlButton>
          <CtrlButton onClick={() => setPlaying((v) => !v)} label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </CtrlButton>
          <CtrlButton onClick={() => step(1)} label="Next"><ChevronRight className="h-4 w-4" /></CtrlButton>
          <CtrlButton onClick={() => { setPlaying(false); setPly(maxPly); }} label="End"><SkipForward className="h-4 w-4" /></CtrlButton>
          <div className="ml-2 min-w-[4rem] text-center text-xs tabular-nums text-white/50">
            {ply} / {maxPly}
          </div>
        </div>
      </footer>
    </div>
  );
}

function CtrlButton({ onClick, label, children }: { onClick(): void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
    >
      {children}
    </button>
  );
}

function Seat({ name, rating, avatarUrl }: { name: string; rating?: number; avatarUrl?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-white/10">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="text-sm font-medium">{name}</div>
      {rating ? <div className="text-xs text-white/40">{rating}</div> : null}
    </div>
  );
}

function Centered({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-zinc-950 p-8 text-center text-white">
      <div>
        <div className="text-xl font-semibold">{title}</div>
        <div className="mt-2 max-w-sm text-sm text-white/60">{detail}</div>
      </div>
    </div>
  );
}

function resultLabel(result: string): string {
  switch (result) {
    case '1-0': return 'White won';
    case '0-1': return 'Black won';
    case '1/2-1/2': return 'Draw';
    default: return result || 'Game over';
  }
}
