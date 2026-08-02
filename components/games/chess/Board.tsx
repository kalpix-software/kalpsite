'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';

import type { ChessSide } from '@/lib/kalpix-web-sdk/chess';

/**
 * Kalpix chess board renderer.
 *
 * Replaces lichess's `chessground` — which is GPL-3.0 and shipped inside the
 * browser bundle, making the whole bundle a copyleft derivative. Everything
 * here is ours, and the piece art is driven by store items rather than the
 * GPL/CC-BY-SA cburnett set.
 *
 * Structure is three stacked layers inside one square container:
 *   1. board   — a single 8x8 image (or a CSS checkerboard when none is equipped)
 *   2. overlay — last-move, check and legal-destination markers
 *   3. pieces  — absolutely positioned sprites animated by `transform`
 *
 * The server remains the only authority. chess.js is used ONLY to precompute
 * legal destinations and detect promotions so the UI can respond instantly;
 * anything it mispredicts is overwritten by the next authoritative state.
 */

export interface BoardProps {
  fen: string;
  orientation: ChessSide;
  turn: ChessSide;
  mySide: ChessSide | null;          // null = spectator
  lastMove?: string;                  // UCI like "e2e4"
  interactive: boolean;               // false when game ended / not started
  onMove(from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): void;
  onPromotionNeeded(from: string, to: string): void;

  /** Full-res board image for THIS viewer. Falls back to a CSS checkerboard. */
  boardUrl?: string;
  /**
   * Piece-set folders, per side. These differ between players on purpose: a
   * piece set is the one chess cosmetic visible to your opponent, so white's
   * pieces come from the white player's set and black's from black's.
   * Undefined falls back to DEFAULT_PIECE_SET.
   */
  whitePieceSetBaseUrl?: string;
  blackPieceSetBaseUrl?: string;
}

const FILES = 'abcdefgh';

/**
 * Art used when a player has equipped nothing. The "classic" variant is the
 * free set every account can render without owning anything, so pointing the
 * fallback here never shows a player art they have not unlocked.
 *
 * Overridable by env so a future default can ship without a code change.
 */
const DEFAULT_PIECE_SET =
  process.env.NEXT_PUBLIC_CHESS_DEFAULT_PIECES ??
  'https://assets.kalpixsoftware.com/games/chess/pieces/classic';

const DEFAULT_BOARD_URL =
  process.env.NEXT_PUBLIC_CHESS_DEFAULT_BOARD ??
  'https://assets.kalpixsoftware.com/games/chess/board/classic/board-1.webp';

/**
 * Squares drawn in CSS when even the default board image fails to load — a
 * blank board is unplayable, so this is the last line of defence rather than
 * a normal path.
 */
const LIGHT_SQUARE = '#e8d0aa';
const DARK_SQUARE = '#8b5a3c';

interface PlacedPiece {
  /** Stable across moves so CSS can animate the sprite between squares. */
  id: number;
  /** FEN character: uppercase = white, lowercase = black. */
  code: string;
  square: string;
}

/** Parse a FEN's placement field into square → piece character. */
function parseFen(fen: string): Map<string, string> {
  const out = new Map<string, string>();
  const placement = fen.split(' ')[0] ?? '';
  const ranks = placement.split('/');
  for (let r = 0; r < ranks.length && r < 8; r++) {
    const rank = 8 - r;
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '9') {
        file += Number(ch);
        continue;
      }
      if (file < 8) out.set(`${FILES[file]}${rank}`, ch);
      file++;
    }
  }
  return out;
}

/** Square → display column/row, accounting for board orientation. */
function squareToXY(square: string, orientation: ChessSide): { col: number; row: number } {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return orientation === 'white'
    ? { col: file, row: 8 - rank }
    : { col: 7 - file, row: rank - 1 };
}

/** Display column/row → square. Inverse of squareToXY. */
function xyToSquare(col: number, row: number, orientation: ChessSide): string | null {
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return orientation === 'white'
    ? `${FILES[col]}${8 - row}`
    : `${FILES[7 - col]}${row + 1}`;
}

function sideOf(code: string): ChessSide {
  return code === code.toUpperCase() ? 'white' : 'black';
}

function pieceUrl(code: string, whiteBase?: string, blackBase?: string): string {
  const white = sideOf(code) === 'white';
  const base = (white ? whiteBase : blackBase) || DEFAULT_PIECE_SET;
  return `${base.replace(/\/$/, '')}/${white ? 'w' : 'b'}${code.toUpperCase()}.webp`;
}

function legalDests(fen: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  try {
    const game = new Chess(fen);
    for (const m of game.moves({ verbose: true })) {
      const arr = out.get(m.from) ?? [];
      arr.push(m.to);
      out.set(m.from, arr);
    }
  } catch {
    // A FEN we can't parse just means no hints; the server still validates.
  }
  return out;
}

function isPromotionMove(fen: string, from: string, to: string): boolean {
  try {
    return new Chess(fen)
      .moves({ verbose: true })
      .some((m) => m.from === from && m.to === to && m.flags.includes('p'));
  } catch {
    return false;
  }
}

/** Square of the side-to-move's king when it is in check, else null. */
function checkedKingSquare(fen: string): string | null {
  try {
    const game = new Chess(fen);
    if (!game.inCheck()) return null;
    const king = game.turn() === 'w' ? 'K' : 'k';
    for (const [square, code] of parseFen(fen)) {
      if (code === king) return square;
    }
  } catch {
    // fall through
  }
  return null;
}

export default function Board(props: BoardProps) {
  const {
    fen, orientation, turn, mySide, lastMove, interactive,
    onMove, onPromotionNeeded, boardUrl, whitePieceSetBaseUrl, blackPieceSetBaseUrl,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ square: string; x: number; y: number } | null>(null);

  // ── Piece identity ────────────────────────────────────────────────────
  // Pieces are keyed by a stable id rather than by square, so React updates
  // an existing node's transform (which animates) instead of unmounting the
  // old square's node and mounting a new one (which would teleport).
  const idsRef = useRef<Map<string, number>>(new Map());
  const nextIdRef = useRef(1);
  const prevFenRef = useRef<string>('');

  /** Square → piece code for the current position. Parsed once per FEN. */
  const board = useMemo(() => parseFen(fen), [fen]);

  const pieces = useMemo<PlacedPiece[]>(() => {
    const prevIds = idsRef.current;
    const nextIds = new Map<string, number>();

    // Carry the moved piece's id from its origin square so it animates.
    // Castling moves a rook too, which the UCI king move doesn't mention —
    // derive it from the two-file king step so the rook slides as well.
    const carried = new Map<string, string>(); // toSquare -> fromSquare
    if (lastMove && lastMove.length >= 4 && prevFenRef.current !== fen) {
      const from = lastMove.slice(0, 2);
      const to = lastMove.slice(2, 4);
      carried.set(to, from);
      const movedCode = board.get(to);
      if (movedCode && movedCode.toUpperCase() === 'K') {
        const fileDelta = FILES.indexOf(to[0]) - FILES.indexOf(from[0]);
        const rank = from[1];
        if (fileDelta === 2) carried.set(`f${rank}`, `h${rank}`);      // king side
        if (fileDelta === -2) carried.set(`d${rank}`, `a${rank}`);     // queen side
      }
    }

    const out: PlacedPiece[] = [];
    for (const [square, code] of board) {
      const origin = carried.get(square);
      const id =
        (origin !== undefined ? prevIds.get(origin) : undefined) ??
        prevIds.get(square) ??
        nextIdRef.current++;
      nextIds.set(square, id);
      out.push({ id, code, square });
    }

    idsRef.current = nextIds;
    prevFenRef.current = fen;
    // Stable order keeps React's reconciliation cheap and predictable.
    return out.sort((a, b) => a.id - b.id);
  }, [board, fen, lastMove]);

  // ── Interaction ───────────────────────────────────────────────────────
  const myTurn = interactive && mySide !== null && turn === mySide;
  const dests = useMemo(() => (myTurn ? legalDests(fen) : new Map<string, string[]>()), [myTurn, fen]);
  const selectedDests = useMemo(
    () => (selected ? dests.get(selected) ?? [] : []),
    [selected, dests],
  );
  const checkSquare = useMemo(() => checkedKingSquare(fen), [fen]);

  // Clearing the selection when the turn ends stops a stale highlight from
  // surviving into the opponent's move.
  useEffect(() => {
    if (!myTurn) {
      setSelected(null);
      setDrag(null);
    }
  }, [myTurn]);

  const commitMove = useCallback(
    (from: string, to: string) => {
      setSelected(null);
      setDrag(null);
      if (isPromotionMove(fen, from, to)) {
        onPromotionNeeded(from, to);
        return;
      }
      onMove(from, to);
    },
    [fen, onMove, onPromotionNeeded],
  );

  /** Pointer position → square, or null when outside the board. */
  const squareAt = useCallback(
    (clientX: number, clientY: number): string | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
      const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
      return xyToSquare(col, row, orientation);
    },
    [orientation],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!myTurn) return;
      const square = squareAt(e.clientX, e.clientY);
      if (!square) return;

      // Second tap on a legal destination completes a click-click move.
      if (selected && selectedDests.includes(square)) {
        commitMove(selected, square);
        return;
      }

      const code = board.get(square);
      if (!code || sideOf(code) !== mySide) {
        setSelected(null);
        return;
      }
      setSelected(square);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDrag({ square, x: e.clientX, y: e.clientY });
    },
    [myTurn, squareAt, selected, selectedDests, commitMove, board, mySide],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      setDrag({ ...drag, x: e.clientX, y: e.clientY });
    },
    [drag],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const target = squareAt(e.clientX, e.clientY);
      const from = drag.square;
      setDrag(null);
      // A tap that never left the origin square keeps the selection so the
      // player can complete the move with a second tap.
      if (!target || target === from) return;
      if ((dests.get(from) ?? []).includes(target)) {
        commitMove(from, target);
      } else {
        setSelected(null);
      }
    },
    [drag, squareAt, dests, commitMove],
  );

  // ── Render ────────────────────────────────────────────────────────────
  const lastFrom = lastMove && lastMove.length >= 4 ? lastMove.slice(0, 2) : null;
  const lastTo = lastMove && lastMove.length >= 4 ? lastMove.slice(2, 4) : null;

  const squareStyle = (square: string): React.CSSProperties => {
    const { col, row } = squareToXY(square, orientation);
    return {
      left: `${col * 12.5}%`,
      top: `${row * 12.5}%`,
      width: '12.5%',
      height: '12.5%',
    };
  };

  // The CSS checkerboard sits UNDER the image rather than replacing it, so a
  // slow or failed image request shows playable squares instead of a void.
  // Each 25% tile of the gradient draws a 2x2 checker, giving 8x8 overall.
  const boardStyle: React.CSSProperties = {
    backgroundImage: `url(${boardUrl || DEFAULT_BOARD_URL}), repeating-conic-gradient(${DARK_SQUARE} 0% 25%, ${LIGHT_SQUARE} 0% 50%)`,
    backgroundSize: '100% 100%, 25% 25%',
  };

  const dragRect = drag ? containerRef.current?.getBoundingClientRect() : undefined;

  return (
    <div
      ref={containerRef}
      className="kalpix-chess-board relative mx-auto aspect-square w-full max-w-[min(100vh,100vw)] select-none overflow-hidden rounded-md"
      style={{ ...boardStyle, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      {/* Last move */}
      {lastFrom && <div className="pointer-events-none absolute bg-yellow-300/35" style={squareStyle(lastFrom)} />}
      {lastTo && <div className="pointer-events-none absolute bg-yellow-300/45" style={squareStyle(lastTo)} />}

      {/* Selection */}
      {selected && <div className="pointer-events-none absolute bg-emerald-300/40" style={squareStyle(selected)} />}

      {/* Check */}
      {checkSquare && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            ...squareStyle(checkSquare),
            background: 'radial-gradient(circle, rgba(239,68,68,0.85) 0%, rgba(239,68,68,0.35) 55%, transparent 72%)',
          }}
        />
      )}

      {/* Legal destinations: a dot on empty squares, a ring on captures. */}
      {selectedDests.map((square) => {
        const occupied = board.has(square);
        return (
          <div key={`dest-${square}`} className="pointer-events-none absolute flex items-center justify-center" style={squareStyle(square)}>
            {occupied ? (
              <div
                className="h-full w-full rounded-full"
                style={{ border: '7% solid rgba(0,0,0,0.35)' }}
              />
            ) : (
              <div className="h-[30%] w-[30%] rounded-full bg-black/30" />
            )}
          </div>
        );
      })}

      {/* Pieces */}
      {pieces.map((piece) => {
        const dragging = drag?.square === piece.square;
        const { col, row } = squareToXY(piece.square, orientation);
        const style: React.CSSProperties = {
          width: '12.5%',
          height: '12.5%',
          left: 0,
          top: 0,
          transform: `translate(${col * 100}%, ${row * 100}%)`,
          backgroundImage: `url(${pieceUrl(piece.code, whitePieceSetBaseUrl, blackPieceSetBaseUrl)})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          // Only animate settled pieces — a transition on the dragged piece
          // would make it lag the finger.
          transition: dragging ? 'none' : 'transform 180ms ease-out',
          zIndex: dragging ? 20 : 10,
          willChange: 'transform',
        };
        if (dragging && drag && dragRect) {
          const size = dragRect.width / 8;
          style.transform = `translate(${drag.x - dragRect.left - size / 2}px, ${drag.y - dragRect.top - size / 2}px)`;
        }
        return <div key={piece.id} className="kalpix-chess-piece pointer-events-none absolute" style={style} />;
      })}
    </div>
  );
}
