// Chess wire contract — mirrors src/chess_game.go in kalpix-backend.
// Op codes and the JSON state shape MUST stay in sync with the Go side.

export const ChessOp = {
  // client → server
  Move:         1,
  Resign:       2,
  OfferDraw:    3,
  RespondDraw:  4,
  ClaimDraw:    5,

  // server → client
  MoveAck:      10,
  GameOver:     11,
  DrawOffered:  12,
  Illegal:      13,
} as const;

export type ChessSide = 'white' | 'black';

export interface ChessPlayerWire {
  userId: string;
  username: string;
  avatarUrl?: string;
  side: ChessSide;
  isBot: boolean;
  rating: number;
  connected: boolean;
  /**
   * R2 folder holding THIS player's equipped piece sprites; the renderer
   * appends the FEN letter it is already drawing (`${base}/wK.webp`).
   *
   * Travels in match state — not resolved per-client — because the piece set
   * is per-SIDE: your set paints your sixteen pieces on your opponent's screen
   * too. Board and background are the opposite (per-viewer, fetched via
   * getChessCosmetics). Empty/absent means the bundled default set.
   */
  pieceSetBaseUrl?: string;
}

/**
 * Per-viewer chess cosmetics — what YOU see, never shown to the opponent.
 * Returned by the `get_chess_cosmetics` RPC. Any empty field means "nothing
 * equipped, render the bundled default".
 *
 * Note `pieceSetBaseUrl` here is for previewing your own equipped set in the
 * lobby's Upgrades tab. In a match, always read each player's own
 * `pieceSetBaseUrl` off ChessPlayerWire instead — using this one would paint
 * your opponent's pieces in your set.
 */
export interface ChessCosmeticsWire {
  boardUrl?: string;
  pieceSetBaseUrl?: string;
  backgroundUrl?: string;
  boardSlug?: string;
  pieceSetSlug?: string;
}

/** The twelve sprite names every piece set must provide, as FEN letters. */
export const CHESS_PIECE_NAMES = [
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wP',
  'bK', 'bQ', 'bR', 'bB', 'bN', 'bP',
] as const;

export type ChessPieceName = (typeof CHESS_PIECE_NAMES)[number];

/**
 * Resolve the sprite URL for a piece, given the owning player's set folder.
 * `fenChar` is the raw FEN character ('K' white king, 'q' black queen), which
 * is what the renderer is already iterating over — no lookup table needed.
 * Returns null when the set is empty so the caller can fall back to defaults.
 */
export function chessPieceUrl(baseUrl: string | undefined, fenChar: string): string | null {
  if (!baseUrl) return null;
  const side = fenChar === fenChar.toUpperCase() ? 'w' : 'b';
  return `${baseUrl}/${side}${fenChar.toUpperCase()}.webp`;
}

export interface ChessStateWire {
  fen: string;
  pgn: string;
  turn: ChessSide;
  whiteMs: number;
  blackMs: number;
  lastMove?: string;
  gameStarted: boolean;
  gameEnded: boolean;
  result?: '1-0' | '0-1' | '1/2-1/2';
  reason?: string;
  drawOfferedBy?: ChessSide | '';
  players: ChessPlayerWire[];
}

export interface ChessMovePayload {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface ChessIllegalPayload {
  reason: string;
}

export interface ChessDrawOfferedPayload {
  by: ChessSide;
}

const td = new TextDecoder();
const te = new TextEncoder();

export function decodeChessJson<T>(bytes: Uint8Array): T {
  return JSON.parse(td.decode(bytes)) as T;
}

export function encodeChessJson(value: unknown): Uint8Array {
  return te.encode(JSON.stringify(value));
}
