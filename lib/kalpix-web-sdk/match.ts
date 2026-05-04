import type { KalpixSocket } from './socket';
import type {
  KalpixMatch,
  KalpixMatchData,
  KalpixMatchPresenceEvent,
  KalpixMatchState,
} from './types';

export interface MatchSession {
  readonly match: KalpixMatch;
  send(opCode: number, data: Uint8Array | Record<string, unknown>): void;
  signal(data: string): Promise<string>;
  onData(fn: (d: KalpixMatchData) => void): () => void;
  onState(fn: (s: KalpixMatchState) => void): () => void;
  onPresence(fn: (p: KalpixMatchPresenceEvent) => void): () => void;
  leave(): void;
}

/**
 * Join a match by id and return a typed session that filters streams to this
 * match only. State payloads are passed through as raw bytes — the caller
 * decodes per-game (e.g. JSON, MessagePack, protobuf).
 */
export async function joinMatch(
  socket: KalpixSocket,
  matchId: string,
  metadata?: Record<string, string>,
): Promise<MatchSession> {
  const match = await socket.joinMatch(matchId, metadata);

  return {
    match,

    send(opCode, data) {
      const bytes =
        data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(JSON.stringify(data));
      socket.sendMatchData(match.matchId, opCode, bytes);
    },

    signal(data) {
      return socket.matchSignal(match.matchId, data);
    },

    onData(fn) {
      return socket.matchData.on((d) => {
        if (d.matchId === match.matchId) fn(d);
      });
    },

    onState(fn) {
      return socket.matchState.on((s) => {
        if (s.matchId === match.matchId) fn(s);
      });
    },

    onPresence(fn) {
      return socket.matchPresence.on((p) => {
        if (p.matchId === match.matchId) fn(p);
      });
    },

    leave() {
      socket.leaveMatch(match.matchId);
    },
  };
}

/** Decode a JSON match_data / match_state byte payload. */
export function decodeJsonBytes<T>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
