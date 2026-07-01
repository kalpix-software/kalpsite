// In-match chat wire contract — mirrors the backend chat stack
// (kalpix-backend/src/tero_chat.go, reused by chess via chess_chat.go).
// Chess chat is text + quick-chat presets only.

export const ChatOp = {
  Text: 20,
  Quick: 22,
  Replay: 23,
  Error: 24,
} as const;

// Quick-chat presets, indexed by quickCode. Order must match the backend
// QuickChatPresets (tero_chat.go); labels are the localized display text.
export const QUICK_CHAT_LABELS: Record<number, string> = {
  0: 'GG',
  1: 'Nice!',
  2: 'Oops',
  3: 'Hurry up!',
  4: 'Sorry',
  5: 'Thanks',
  6: 'Wow!',
  7: 'Lucky!',
  8: 'Well played',
  9: 'Let me think…',
};

export const ChatLimits = { MaxTextLen: 200 } as const;

export type ChatKind = 'text' | 'sticker' | 'quick';

export interface ChatEntry {
  seq: number;
  senderId: string;
  username?: string;
  kind: ChatKind;
  text?: string;
  stickerId?: string;
  quickCode?: number;
  tsMs: number;
}

export interface ChatReplay {
  entries: ChatEntry[];
  seq: number;
  disabled: boolean;
  quickChatPresets?: string[];
}

export interface ChatError {
  code: string;
  message: string;
  tsMs: number;
}

const _td = new TextDecoder();
const _te = new TextEncoder();

export function decodeChat<T>(bytes: Uint8Array): T {
  return JSON.parse(_td.decode(bytes)) as T;
}

export function encodeChat(value: unknown): Uint8Array {
  return _te.encode(JSON.stringify(value));
}

/** Display text for a chat entry (resolves quick-chat codes to labels). */
export function chatEntryText(e: ChatEntry): string {
  if (e.kind === 'quick') {
    return QUICK_CHAT_LABELS[e.quickCode ?? -1] ?? e.text ?? '';
  }
  return e.text ?? '';
}
