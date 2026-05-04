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

const HUMAN_WAIT_MS = 5_000;
const RATING_BAND = 150;

export interface MatchmakingDialogProps {
  client: KalpixClient;
  games: GameApi;
  timeControl: 'blitz' | 'rapid';
  rating: number;
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

        const handle = findMatch(p.client.socket, {
          minCount: 2,
          maxCount: 2,
          query: `+properties.gameId:chess +properties.timeControl:${p.timeControl} +properties.rated:true properties.rating:>=${
            p.rating - RATING_BAND
          } properties.rating:<=${p.rating + RATING_BAND}`,
          stringProperties: {
            gameId: 'chess',
            timeControl: p.timeControl,
            rated: 'true',
          },
          numericProperties: { rating: p.rating },
          timeoutMs: HUMAN_WAIT_MS,
          onTimeout: async () => {
            if (cancelled) return null;
            setPhase('fallback');
            const { matchId } = await p.games.findOrCreateChessMatch({
              timeControl: p.timeControl,
              rated: false,
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
  }, [p.timeControl, p.rating]);

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
            <div className="text-xs" style={{ color: lobbyTheme.textDim }}>
              Falling back to bot in {secondsLeft}s
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
            No human found nearby — preparing a bot…
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
