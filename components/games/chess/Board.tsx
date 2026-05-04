'use client';

import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api as CgApi } from 'chessground/api';
import type { Config as CgConfig } from 'chessground/config';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';

import type { ChessSide } from '@/lib/kalpix-web-sdk/chess';

export interface BoardProps {
  fen: string;
  orientation: ChessSide;
  turn: ChessSide;
  mySide: ChessSide | null;          // null = spectator
  lastMove?: string;                  // UCI like "e2e4"
  interactive: boolean;               // false when game ended / not started
  onMove(from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): void;
  onPromotionNeeded(from: string, to: string): void;
}

/**
 * Chessground wrapper. Computes legal destinations client-side via chess.js
 * for instant move-square highlighting; the server is still the only authority
 * — illegal moves come back as OP_CHESS_ILLEGAL and we just rely on the next
 * authoritative state to overwrite anything we mispredicted.
 */
export default function Board(props: BoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<CgApi | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const buildConfig = (p: BoardProps): CgConfig => {
    const myTurn = p.interactive && p.mySide !== null && p.turn === p.mySide;
    const dests = myTurn ? legalDests(p.fen) : new Map<Key, Key[]>();
    const lastMove = parseLastMove(p.lastMove);

    return {
      fen: p.fen,
      orientation: p.orientation,
      turnColor: p.turn,
      lastMove,
      coordinates: true,
      movable: {
        free: false,
        color: p.mySide ?? undefined,
        dests,
        showDests: true,
        events: {
          after: (orig: Key, dest: Key) => {
            const handler = propsRef.current;
            if (isPromotionMove(handler.fen, orig as string, dest as string)) {
              handler.onPromotionNeeded(orig as string, dest as string);
              return;
            }
            handler.onMove(orig as string, dest as string);
          },
        },
      },
      premovable: { enabled: true },
      drawable: { enabled: true, visible: true },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },
    };
  };

  // One-time mount.
  useEffect(() => {
    if (!containerRef.current) return;
    const api = Chessground(containerRef.current, buildConfig(propsRef.current));
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push prop updates into the existing chessground instance.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.set(buildConfig(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fen, props.orientation, props.turn, props.mySide, props.lastMove, props.interactive]);

  return (
    <div
      ref={containerRef}
      className="aspect-square w-full max-w-[min(100vh,100vw)] mx-auto select-none"
      style={{ touchAction: 'none' }}
    />
  );
}

function legalDests(fen: string): Map<Key, Key[]> {
  const game = new Chess(fen);
  const out = new Map<Key, Key[]>();
  for (const m of game.moves({ verbose: true })) {
    const arr = out.get(m.from as Key) ?? [];
    arr.push(m.to as Key);
    out.set(m.from as Key, arr);
  }
  return out;
}

function isPromotionMove(fen: string, from: string, to: string): boolean {
  const game = new Chess(fen);
  return game
    .moves({ verbose: true })
    .some((m) => m.from === from && m.to === to && m.flags.includes('p'));
}

function parseLastMove(uci?: string): [Key, Key] | undefined {
  if (!uci || uci.length < 4) return undefined;
  return [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key];
}
