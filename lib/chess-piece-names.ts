/**
 * The twelve chess piece sprite names, in the order an admin uploads them.
 *
 * Lives here rather than in the web SDK because the chess *webview* was removed
 * when the game went native in Flutter — but `/admin/chess-cosmetics` is still
 * how piece sets are published, and it needs to know which twelve files make a
 * complete set.
 *
 * Format is `<side><piece>`: `w`/`b` then the standard FEN letter. The uploader
 * matches these against the stems of the dropped files, so renaming any of them
 * silently breaks the "which sprites are missing?" check.
 */
export const CHESS_PIECE_NAMES = [
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wP',
  'bK', 'bQ', 'bR', 'bB', 'bN', 'bP',
] as const;

export type ChessPieceName = (typeof CHESS_PIECE_NAMES)[number];
