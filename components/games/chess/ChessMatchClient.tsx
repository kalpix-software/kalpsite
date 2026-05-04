'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  KalpixClient,
  joinMatch,
  resolveRuntimeHost,
  type MatchSession,
} from '@/lib/kalpix-web-sdk';
import {
  ChessOp,
  decodeChessJson,
  encodeChessJson,
  type ChessIllegalPayload,
  type ChessSide,
  type ChessStateWire,
} from '@/lib/kalpix-web-sdk/chess';

import Board from './Board';
import Clock from './Clock';
import PromotionPicker from './PromotionPicker';
import MoveList from './MoveList';

// Host is resolved at runtime (URL query → sessionStorage → env) so the
// same kalpsite build can serve both a real device on the LAN and an
// emulator at 10.0.2.2 from the same `next dev` instance.

interface PendingPromotion {
  from: string;
  to: string;
}

interface DebugInfo {
  step: string;
  connected: boolean;
  joined: boolean;
  dataCount: number;
  stateCount: number;
  lastOp: number | null;
  lastErr: string | null;
  reconnects: number;
}

export default function ChessMatchClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ChessStateWire | null>(null);
  const [stateAt, setStateAt] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingPromo, setPendingPromo] = useState<PendingPromotion | null>(null);
  const [debug, setDebug] = useState<DebugInfo>({
    step: 'mounting',
    connected: false,
    joined: false,
    dataCount: 0,
    stateCount: 0,
    lastOp: null,
    lastErr: null,
    reconnects: 0,
  });

  const clientRef = useRef<KalpixClient | null>(null);
  const sessionRef = useRef<MatchSession | null>(null);
  const myUserIdRef = useRef<string>('');

  const bumpDebug = useCallback((patch: Partial<DebugInfo>) => {
    setDebug((d) => ({ ...d, ...patch }));
  }, []);

  // Boot: build client, connect, join match, subscribe.
  useEffect(() => {
    let cancelled = false;
    const { host, ssl } = resolveRuntimeHost();
    const client = new KalpixClient({
      config: { host, ssl },
    });
    clientRef.current = client;

    // CRITICAL: subscribe to match_data / match_state BEFORE sending
    // match_join. The server's MatchJoin handler broadcasts the initial
    // state inside MatchJoin itself — that broadcast can race ahead of the
    // match_joined response, and any listener attached after the await
    // would miss it. We have matchId from the route, so we filter by it
    // directly without waiting for the join response.
    let dataN = 0;
    let stateN = 0;
    const unsubData = client.socket.matchData.on((d) => {
      if (cancelled) return;
      dataN++;
      bumpDebug({ dataCount: dataN, lastOp: d.opCode });
      if (d.matchId !== matchId) return;
      try {
        handleOpCode(d.opCode, d.data);
      } catch (e) {
        bumpDebug({ lastErr: `data: ${e instanceof Error ? e.message : String(e)}` });
      }
    });
    const unsubState = client.socket.matchState.on((s) => {
      if (cancelled) return;
      stateN++;
      bumpDebug({ stateCount: stateN });
      if (s.matchId !== matchId) return;
      if (s.state.byteLength === 0) return;
      try {
        applyAuthoritativeState(decodeChessJson<ChessStateWire>(s.state));
      } catch (e) {
        bumpDebug({ lastErr: `state: ${e instanceof Error ? e.message : String(e)}` });
      }
    });

    // When the WS drops mid-game and reconnects, the match-stream presence
    // for the previous session ID is dead — subsequent broadcasts go nowhere.
    // We have to re-issue match_join on the reconnected socket so the
    // tracker registers the new session ID. Without this, every state
    // update after the first disconnect requires the user to manually
    // leave + rejoin the match.
    let reconnectCount = 0;
    const unsubClosed = client.socket.closed.on(() => {
      bumpDebug({ connected: false });
    });
    const unsubReconnected = client.socket.reconnected.on(() => {
      reconnectCount++;
      bumpDebug({ connected: true, reconnects: reconnectCount, step: 'rejoining' });
      // Re-join the match on the newly-opened socket. We can't use the
      // previous session.match handle — the server allocated a new session
      // id for this WS and wants a fresh match_join.
      joinMatch(client.socket, matchId)
        .then((session) => {
          if (cancelled) {
            session.leave();
            return;
          }
          sessionRef.current = session;
          bumpDebug({ step: 'rejoined', joined: true });
        })
        .catch((e) => {
          bumpDebug({
            step: 'rejoin-error',
            lastErr: e instanceof Error ? e.message : String(e),
          });
        });
    });

    (async () => {
      try {
        bumpDebug({ step: 'bootstrap-session' });
        const auth = await client.bootstrapSession();
        if (cancelled) return;
        if (!auth?.token) {
          setError('No session token. Open this page from the Plazy app.');
          return;
        }
        myUserIdRef.current = auth.userId ?? '';

        bumpDebug({ step: 'connecting-ws' });
        await client.connect();
        if (cancelled) return;
        bumpDebug({ step: 'joining-match', connected: true });
        const session = await joinMatch(client.socket, matchId);
        if (cancelled) {
          session.leave();
          return;
        }
        sessionRef.current = session;
        bumpDebug({ step: 'joined', joined: true });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        bumpDebug({ step: 'error', lastErr: msg });
        setError(msg);
      }
    })();

    // Poll the server for current state every second as a guaranteed-delivery
    // safety net over the WS broadcast. Mobile WebViews can silently drop or
    // pause WS frames; rather than chase every flavor of disconnect, we just
    // pull the authoritative state on a steady cadence. The Tero client uses
    // the same pull-pattern alongside its socket pushes.
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const session = sessionRef.current;
      if (!session) return;
      try {
        const data = await session.signal('{"action":"get_state"}');
        if (cancelled || !data) return;
        const next = JSON.parse(data) as ChessStateWire;
        applyAuthoritativeState(next);
      } catch {
        // Signal failures are expected during reconnect — quietly retry next tick.
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      unsubData();
      unsubState();
      unsubClosed();
      unsubReconnected();
      sessionRef.current?.leave();
      sessionRef.current = null;
      client.dispose();
      clientRef.current = null;
    };
  }, [matchId]);

  const handleOpCode = useCallback((op: number, data: Uint8Array) => {
    switch (op) {
      case ChessOp.MoveAck:
      case ChessOp.GameOver:
        applyAuthoritativeState(decodeChessJson<ChessStateWire>(data));
        return;
      case ChessOp.Illegal: {
        const payload = decodeChessJson<ChessIllegalPayload>(data);
        flashToast(`Illegal: ${payload.reason}`);
        // Force re-render from current authoritative state to revert any
        // optimistic UI movement chessground may have applied.
        setState((s) => (s ? { ...s } : s));
        setStateAt(Date.now());
        return;
      }
      case ChessOp.DrawOffered: {
        const { by } = decodeChessJson<{ by: ChessSide }>(data);
        flashToast(`${by === 'white' ? 'White' : 'Black'} offered a draw`);
        return;
      }
      default:
        return;
    }
  }, []);

  const applyAuthoritativeState = useCallback((next: ChessStateWire) => {
    setState(next);
    setStateAt(Date.now());
  }, []);

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

  // ── Derived view state ───────────────────────────────────────────────
  const me = useMemo(
    () => state?.players.find((p) => p.userId === myUserIdRef.current) ?? null,
    [state],
  );
  const opponent = useMemo(
    () => state?.players.find((p) => p.userId !== myUserIdRef.current) ?? null,
    [state],
  );
  const mySide: ChessSide | null = me?.side ?? null;
  const orientation: ChessSide = mySide ?? 'white';

  const interactive = !!(state?.gameStarted && !state?.gameEnded && mySide);

  const sendMove = useCallback(
    (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
      const session = sessionRef.current;
      if (!session) return;
      session.send(ChessOp.Move, encodeChessJson({ from, to, promotion }));
    },
    [],
  );

  const sendResign = useCallback(() => {
    sessionRef.current?.send(ChessOp.Resign, encodeChessJson({}));
  }, []);

  const sendOfferDraw = useCallback(() => {
    sessionRef.current?.send(ChessOp.OfferDraw, encodeChessJson({}));
  }, []);

  const sendRespondDraw = useCallback((accept: boolean) => {
    sessionRef.current?.send(ChessOp.RespondDraw, encodeChessJson({ accept }));
  }, []);

  // ── Render ───────────────────────────────────────────────────────────

  if (error) {
    return <FullscreenMessage title="Could not start match" detail={error} onClose={() => router.back()} debug={debug} matchId={matchId} />;
  }
  if (!state) {
    return <FullscreenMessage title="Joining match…" detail="" debug={debug} matchId={matchId} />;
  }

  const myTurn = interactive && state.turn === mySide;
  const drawIncoming = state.drawOfferedBy && state.drawOfferedBy !== mySide;

  return (
    <div className="relative flex min-h-dvh flex-col bg-zinc-950 text-white">
      {/* Live debug strip — counters increment per inbound message, the FEN
          mirror lets us see if state updates are reaching the UI in real
          time (vs. only on rejoin). Remove or gate behind NEXT_PUBLIC_DEBUG
          once stable. */}
      <DebugStrip
        debug={debug}
        fen={state.fen}
        turn={state.turn}
        mySide={mySide}
      />
      {/* Top: opponent clock + status */}
      <header className="flex items-center gap-3 px-3 pt-3">
        <PlayerStrip
          name={opponent?.username ?? 'Waiting…'}
          rating={opponent?.rating}
          isBot={opponent?.isBot}
          connected={opponent?.connected ?? false}
        />
        <div className="flex-1">
          <Clock
            label={opponent?.username ?? 'Opponent'}
            ms={
              opponent?.side === 'white' ? state.whiteMs : state.blackMs
            }
            serverNowMs={stateAt}
            ticking={interactive && state.turn !== mySide}
          />
        </div>
      </header>

      {/* Board */}
      <div className="relative flex-1 px-2 py-2">
        <Board
          fen={state.fen}
          orientation={orientation}
          turn={state.turn}
          mySide={mySide}
          lastMove={state.lastMove}
          interactive={interactive && myTurn}
          onMove={(from, to) => sendMove(from, to)}
          onPromotionNeeded={(from, to) => setPendingPromo({ from, to })}
        />
        {pendingPromo && mySide && (
          <PromotionPicker
            side={mySide}
            onPick={(piece) => {
              sendMove(pendingPromo.from, pendingPromo.to, piece);
              setPendingPromo(null);
            }}
            onCancel={() => setPendingPromo(null)}
          />
        )}
      </div>

      {/* Bottom: my clock + actions + moves */}
      <footer className="flex flex-col gap-2 px-3 pb-3">
        <div className="flex items-center gap-3">
          <PlayerStrip
            name={me?.username ?? 'You'}
            rating={me?.rating}
            isBot={false}
            connected={me?.connected ?? true}
          />
          <div className="flex-1">
            <Clock
              label={me?.username ?? 'You'}
              ms={mySide === 'white' ? state.whiteMs : state.blackMs}
              serverNowMs={stateAt}
              ticking={interactive && state.turn === mySide}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <ActionButton
            disabled={!interactive}
            onClick={() => {
              if (confirm('Resign this game?')) sendResign();
            }}
          >
            Resign
          </ActionButton>
          {drawIncoming ? (
            <>
              <ActionButton onClick={() => sendRespondDraw(true)}>
                Accept draw
              </ActionButton>
              <ActionButton onClick={() => sendRespondDraw(false)}>
                Decline
              </ActionButton>
            </>
          ) : (
            <ActionButton
              disabled={!interactive || !!state.drawOfferedBy}
              onClick={sendOfferDraw}
            >
              Offer draw
            </ActionButton>
          )}
        </div>

        <MoveList pgn={state.pgn} />
      </footer>

      {state.gameEnded && (
        <ResultOverlay
          state={state}
          mySide={mySide}
          onClose={() => router.replace('/games/chess/lobby')}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-16 flex justify-center">
          <div className="rounded-md bg-black/80 px-4 py-2 text-sm shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────

function PlayerStrip({
  name,
  rating,
  isBot,
  connected,
}: {
  name: string;
  rating?: number;
  isBot?: boolean;
  connected: boolean;
}) {
  return (
    <div className="flex w-32 flex-col">
      <div className="flex items-center gap-1 text-sm font-medium">
        <span>{name}</span>
        {isBot && <span className="rounded bg-purple-600/40 px-1 text-[10px]">BOT</span>}
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connected ? 'bg-emerald-400' : 'bg-zinc-500'
          }`}
        />
      </div>
      {typeof rating === 'number' && (
        <div className="text-xs text-white/50">{rating}</div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-md bg-white/10 px-3 py-2 text-sm font-medium transition hover:bg-white/20 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ResultOverlay({
  state,
  mySide,
  onClose,
}: {
  state: ChessStateWire;
  mySide: ChessSide | null;
  onClose: () => void;
}) {
  const headline =
    state.result === '1/2-1/2'
      ? 'Draw'
      : (state.result === '1-0' && mySide === 'white') ||
        (state.result === '0-1' && mySide === 'black')
      ? 'You win'
      : mySide
      ? 'You lose'
      : (state.result ?? 'Game over');

  // Auto-return to lobby after a few seconds so resign / draw / mate all
  // unwind back to the lobby without requiring a tap. The button is still
  // available for users who want to dismiss faster.
  const [secs, setSecs] = useState(5);
  useEffect(() => {
    if (secs <= 0) {
      onClose();
      return;
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onClose]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
      <div className="rounded-lg bg-zinc-900 p-6 text-center shadow-2xl">
        <div className="text-3xl font-semibold">{headline}</div>
        <div className="mt-2 text-sm text-white/60">
          {state.reason ?? state.result}
        </div>
        <button
          onClick={onClose}
          className="mt-6 rounded-md bg-white/10 px-6 py-2 text-sm font-medium hover:bg-white/20"
        >
          Back to lobby ({secs})
        </button>
      </div>
    </div>
  );
}

function DebugStrip({
  debug,
  fen,
  turn,
  mySide,
}: {
  debug: DebugInfo;
  fen: string;
  turn: ChessSide;
  mySide: ChessSide | null;
}) {
  const fenTail = fen.split(' ')[0]?.slice(-12) ?? '?';
  return (
    <div className="bg-black/60 px-2 py-1 font-mono text-[10px] text-white/70">
      ws:{debug.connected ? 'on' : 'off'} rc:{debug.reconnects} · d:
      {debug.dataCount} s:{debug.stateCount} op:{debug.lastOp ?? '—'} · turn:
      {turn[0]} me:{mySide?.[0] ?? '—'} · fen…{fenTail}
      {debug.lastErr && (
        <span className="ml-2 text-red-400">err:{debug.lastErr}</span>
      )}
    </div>
  );
}

function FullscreenMessage({
  title,
  detail,
  onClose,
  debug,
  matchId,
}: {
  title: string;
  detail: string;
  onClose?: () => void;
  debug?: DebugInfo;
  matchId?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 p-8 text-center text-white">
      <div className="text-2xl font-semibold">{title}</div>
      {detail && <div className="mt-2 text-sm text-white/60">{detail}</div>}
      {debug && (
        <pre className="mt-6 max-w-full overflow-x-auto rounded-md bg-black/60 p-3 text-left font-mono text-[11px] leading-relaxed text-white/80">
{`step:        ${debug.step}
matchId:     ${matchId ?? '?'}
connected:   ${debug.connected}
joined:      ${debug.joined}
dataCount:   ${debug.dataCount}    (any match)
stateCount:  ${debug.stateCount}   (any match)
lastOp:      ${debug.lastOp ?? '—'}
lastErr:     ${debug.lastErr ?? '—'}`}
        </pre>
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="mt-6 rounded-md bg-white/10 px-6 py-2 text-sm hover:bg-white/20"
        >
          Back
        </button>
      )}
    </div>
  );
}
