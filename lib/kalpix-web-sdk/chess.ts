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
  side: ChessSide;
  isBot: boolean;
  rating: number;
  connected: boolean;
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
