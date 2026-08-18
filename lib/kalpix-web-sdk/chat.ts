// In-match chat wire contract — mirrors the backend chat stack
// (kalpix-backend/src/tero_chat.go, reused by chess via chess_chat.go).
// Chess handles the same four inbound ops Tero does.

export const ChatOp = {
  Text: 20,
  /** Client sends {stickerId}; the SERVER resolves the art (see stickerUrl). */
  Sticker: 21,
  Quick: 22,
  Replay: 23,
  Error: 24,
  /** Creator-only switch in a private match. Client sends {disabled}. */
  SetDisabled: 25,
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

/**
 * The sender's chosen chat bubble, resolved server-side per match.
 *
 * Comes from the speaker's global chat preferences, so a message renders in
 * THEIR bubble on everyone's screen — the receiver cannot know it otherwise.
 * Absent when the user has set none; fall back to the built-in bubble.
 */
export interface SenderAppearance {
  bubbleStyleId: string;
  name?: string;
  leftBubbleUrl: string;
  rightBubbleUrl: string;
  accentColor?: string;
  /**
   * Text colours the bubble style was designed with (e.g. "#FFFFFF" sent,
   * "#222222" received). Used so a light accent doesn't end up with white text
   * on a light bubble.
   */
  sentTextColor?: string;
  receivedTextColor?: string;
  /**
   * Nine-patch geometry as raw JSON. Present for completeness — note the
   * themed art in Plak is drawn by a bespoke painter, not this slice, so a
   * web client cannot reproduce it from these numbers alone.
   */
  sentCenterSlice?: string;
  sentPadding?: string;
  receivedCenterSlice?: string;
  receivedPadding?: string;
}

export interface ChatEntry {
  seq: number;
  senderId: string;
  username?: string;
  kind: ChatKind;
  text?: string;
  stickerId?: string;
  /**
   * Server-resolved from stickerId, never client-supplied: only the sender's
   * own client knows what art an id maps to, so without this every other
   * player would render an empty bubble.
   */
  stickerUrl?: string;
  quickCode?: number;
  tsMs: number;
  appearance?: SenderAppearance;
}

export interface ChatReplay {
  entries: ChatEntry[];
  seq: number;
  disabled: boolean;
  /**
   * Whether THIS viewer owns the chat switch. Server-decided (creator of a
   * private match) and delivered on every replay, including a mid-match
   * rejoin — never inferred client-side from identity.
   */
  canToggle?: boolean;
  quickChatPresets?: string[];
}

/** Broadcast when the creator flips the switch (op 25). */
export interface ChatDisabledState {
  disabled: boolean;
  by: string;
  tsMs: number;
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
