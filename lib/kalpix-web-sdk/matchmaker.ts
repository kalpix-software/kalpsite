import type { KalpixSocket } from './socket';
import type { MatchmakerMatched } from './types';

export interface FindMatchOptions {
  minCount: number;
  maxCount: number;
  query?: string;
  stringProperties?: Record<string, string>;
  numericProperties?: Record<string, number>;
  /** How long to wait for a real match before invoking `onTimeout`. */
  timeoutMs?: number;
  /** Called if no human match is found before `timeoutMs` elapses. */
  onTimeout?: () => Promise<MatchmakerMatched | null> | MatchmakerMatched | null;
}

export interface MatchmakerHandle {
  /**
   * Resolves with either a matchmaker_matched payload (real match) or whatever
   * the `onTimeout` fallback returns (e.g. a synthetic matched payload pointing
   * at a bot match the caller created via RPC).
   */
  result: Promise<MatchmakerMatched | null>;
  /** Cancel the pending ticket. Safe to call after resolution. */
  cancel(): void;
}

/**
 * Mirrors the Tero pattern: enqueue a matchmaker ticket, wait up to `timeoutMs`
 * for `matchmaker_matched`, otherwise call `onTimeout` (typically: remove the
 * ticket then RPC `find_or_create_<game>_match` + `add_bot_to_<game>_match`).
 */
export function findMatch(
  socket: KalpixSocket,
  opts: FindMatchOptions,
): MatchmakerHandle {
  const timeoutMs = opts.timeoutMs ?? 5_000;
  let cancelled = false;
  let unsubMatched: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  // The ticket id is delivered asynchronously via the rpc_response to
  // matchmaker_add. Both timeout and cancel must wait for it before issuing
  // matchmaker_remove — otherwise a dangling ticket can pair with another
  // ticket later (e.g. a fast-double-tap from the same user) and the user
  // gets matched into a stale match while already in a bot game.
  const ticketPromise = socket
    .addMatchmakerTicket({
      minCount: opts.minCount,
      maxCount: opts.maxCount,
      query: opts.query,
      stringProperties: opts.stringProperties,
      numericProperties: opts.numericProperties,
    })
    .catch(() => '' as string);

  const removeTicketIfAny = async (): Promise<void> => {
    try {
      const t = await ticketPromise;
      if (t) socket.removeMatchmakerTicket(t);
    } catch {}
  };

  const result = new Promise<MatchmakerMatched | null>((resolve, reject) => {
    unsubMatched = socket.anyMessage.on((env) => {
      if (cancelled) return;
      if (env.type !== 'matchmaker_matched') return;
      const m = env.matchmaker_matched;
      if (!m) return;
      cleanup();
      resolve(m);
    });

    ticketPromise.catch((err) => {
      if (cancelled) return;
      cleanup();
      reject(err as Error);
    });

    timer = setTimeout(async () => {
      if (cancelled) return;
      // Pull the ticket so we don't get matched after the bot is added.
      await removeTicketIfAny();
      try {
        const fb = (await opts.onTimeout?.()) ?? null;
        cleanup();
        resolve(fb);
      } catch (err) {
        cleanup();
        reject(err as Error);
      }
    }, timeoutMs);
  });

  function cleanup(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    if (unsubMatched) unsubMatched();
    unsubMatched = null;
  }

  return {
    result,
    cancel(): void {
      if (cancelled) return;
      cancelled = true;
      // Fire-and-await — caller doesn't need to wait, but we MUST wait for
      // the ticket id before issuing remove or it's a no-op.
      void removeTicketIfAny();
      cleanup();
    },
  };
}
