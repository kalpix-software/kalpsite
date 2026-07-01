'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  findMatch,
  type KalpixClient,
  type MatchmakerHandle,
} from '@/lib/kalpix-web-sdk';
import type { GameApi } from '@/lib/kalpix-web-sdk/games';
import { lobbyTheme } from '@/components/games/shell/theme';

import { DialogShell } from './CreatePrivateDialog';

// Human-search window before falling back to a bot.
const HUMAN_WAIT_MS = 5_000;

export interface MatchmakingDialogProps {
  client: KalpixClient;
  games: GameApi;
  timeControl: 'blitz' | 'rapid';
  rating: number;
  provisional?: boolean;
  onClose(cancelled: boolean): void;
  onMatchReady(matchId: string): void;
}

type Phase = 'searching' | 'fallback' | 'cancelled' | 'error';

export default function MatchmakingDialog(p: MatchmakingDialogProps) {
  const [phase, setPhase] = useState<Phase>('searching');
  const [secondsLeft, setSecondsLeft] = useState(HUMAN_WAIT_MS / 1000);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<MatchmakerHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    let countdown: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      try {
        if (!p.client.socket.isConnected) {
          await p.client.connect();
        }

        countdown = setInterval(() => {
          setSecondsLeft((s) => Math.max(0, s - 1));
        }, 1000);

        // One ticket with an IDENTICAL query for every player (the custom
        // matchmaker groups by exact query string, so per-player rating must NOT
        // be in the query). Rating + provisional are passed as properties; the
        // server matchmaker pairs within a rating band that widens with ticket
        // age (±150→±350→±800 established; ±400→±1000 provisional). After
        // HUMAN_WAIT_MS with no human in band, fall back to a bot.
        const handle = findMatch(p.client.socket, {
          minCount: 2,
          maxCount: 2,
          query: `+properties.gameId:chess +properties.timeControl:${p.timeControl} +properties.rated:true`,
          stringProperties: {
            gameId: 'chess',
            timeControl: p.timeControl,
            rated: 'true',
            // Server-side matchmaker expands the rating band by ticket age; this
            // tells it to start wider for unsettled (provisional) players.
            provisional: p.provisional ? 'true' : 'false',
          },
          numericProperties: { rating: p.rating },
          timeoutMs: HUMAN_WAIT_MS,
          onTimeout: async () => {
            if (cancelled) return null;
            setPhase('fallback');
            const { matchId } = await p.games.findOrCreateChessMatch({
              timeControl: p.timeControl,
              rated: true, // bot matches are rated — the bot counts as a real opponent
              allowBot: true,
            });
            await p.games.addBotToChessMatch({
              matchId,
              difficulty: ratingToDifficulty(p.rating),
            });
            return { ticket: '', match_id: matchId };
          },
        });
        handleRef.current = handle;

        const matched = await handle.result;
        if (cancelled) return;
        if (countdown) clearInterval(countdown);
        if (matched?.match_id) {
          p.onMatchReady(matched.match_id);
        } else {
          setPhase('error');
          setError('No match found');
        }
      } catch (e) {
        if (cancelled) return;
        setPhase('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    run();

    return () => {
      cancelled = true;
      if (countdown) clearInterval(countdown);
      handleRef.current?.cancel();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.timeControl, p.rating, p.provisional]);

  const cancel = () => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setPhase('cancelled');
    p.onClose(true);
  };

  const tcLabel = p.timeControl === 'blitz' ? 'Blitz 5+0' : 'Rapid 10+0';

  return (
    <DialogShell title="Finding a match" onClose={cancel}>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Loader2
          className={`h-8 w-8 ${phase === 'searching' || phase === 'fallback' ? 'animate-spin' : ''}`}
          style={{ color: lobbyTheme.primary }}
        />

        <div className="text-base font-semibold text-white">{tcLabel}</div>

        {phase === 'searching' && (
          <>
            <div className="text-sm" style={{ color: lobbyTheme.textMuted }}>
              Searching for a player near rating {p.rating}…
            </div>
            <div
              className="mt-2 h-1 w-48 overflow-hidden rounded-full"
              style={{ background: lobbyTheme.cardSoft }}
            >
              <div
                className="h-full transition-[width] duration-1000"
                style={{
                  width: `${((HUMAN_WAIT_MS / 1000 - secondsLeft) / (HUMAN_WAIT_MS / 1000)) * 100}%`,
                  background: lobbyTheme.primary,
                }}
              />
            </div>
          </>
        )}

        {phase === 'fallback' && (
          <div className="text-sm" style={{ color: lobbyTheme.textMuted }}>
            Setting up your match…
          </div>
        )}

        {phase === 'error' && (
          <div className="text-sm" style={{ color: lobbyTheme.danger }}>
            {error ?? 'Something went wrong'}
          </div>
        )}
      </div>

      <button
        onClick={cancel}
        className="mt-2 w-full rounded-lg py-3 text-sm font-semibold text-white"
        style={{ background: lobbyTheme.cardSoft }}
      >
        {phase === 'error' ? 'Close' : 'Cancel'}
      </button>
    </DialogShell>
  );
}

function ratingToDifficulty(rating: number): number {
  if (rating < 1000) return 1;
  if (rating < 1300) return 2;
  if (rating < 1700) return 3;
  if (rating < 2000) return 4;
  return 5;
}
