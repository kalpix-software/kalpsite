import { buildWsUrl, type ResolvedConfig } from './config';
import {
  KalpixError,
  KalpixSocketError,
  KalpixTimeoutError,
} from './errors';
import type { SessionStore } from './auth';
import type {
  Envelope,
  EnvelopeType,
  KalpixMatch,
  KalpixMatchData,
  KalpixMatchPresenceEvent,
  KalpixMatchState,
  RpcEnvelope,
} from './types';

type Listener<T> = (value: T) => void;

class EventBus<T> {
  private listeners = new Set<Listener<T>>();
  emit(value: T): void {
    for (const l of this.listeners) l(value);
  }
  on(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

interface PendingRequest {
  resolve: (env: Envelope) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;
const RPC_TIMEOUT_MS = 30_000;
const JOIN_TIMEOUT_MS = 15_000;
const SIGNAL_TIMEOUT_MS = 15_000;

export class KalpixSocket {
  private ws: WebSocket | null = null;
  private connected = false;
  private cidCounter = 0;
  private pending = new Map<string, PendingRequest>();
  private reconnectMs = INITIAL_RECONNECT_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnecting = false;
  autoReconnect = true;

  readonly matchData = new EventBus<KalpixMatchData>();
  readonly matchState = new EventBus<KalpixMatchState>();
  readonly matchPresence = new EventBus<KalpixMatchPresenceEvent>();
  readonly reconnected = new EventBus<void>();
  readonly closed = new EventBus<{ code: number; reason: string }>();
  readonly anyMessage = new EventBus<Envelope>();

  constructor(
    private cfg: ResolvedConfig,
    private session: SessionStore,
  ) {}

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const s = this.session.current;
    if (!s) throw new KalpixSocketError('No session token to connect with');

    const url = buildWsUrl(this.cfg, s.token);
    const ws = new WebSocket(url);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new KalpixTimeoutError('WebSocket connection timed out'));
        try {
          ws.close();
        } catch {}
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        clearTimeout(t);
        this.connected = true;
        this.reconnectMs = INITIAL_RECONNECT_MS;
        resolve();
      };
      ws.onerror = () => {
        // onerror fires before onclose; surface failure via the close path.
      };
      ws.onclose = (ev) => {
        const wasConnected = this.connected;
        this.connected = false;
        this.failPending(`WebSocket closed: ${ev.reason || ev.code}`);
        this.closed.emit({ code: ev.code, reason: ev.reason });
        if (!wasConnected) {
          clearTimeout(t);
          reject(new KalpixSocketError(`WebSocket failed: ${ev.code}`));
        }
        this.scheduleReconnect();
      };
      ws.onmessage = (ev) => this.handleIncoming(ev.data);
    });
  }

  disconnect(): void {
    this.autoReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnecting = false;
    this.connected = false;
    this.failPending('Disconnected');
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (!this.autoReconnect) return;
    if (this.reconnecting) return;
    if (!this.session.current) return;

    this.reconnecting = true;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnecting = false;
      if (this.connected) return;
      try {
        await this.connect();
        this.reconnectMs = INITIAL_RECONNECT_MS;
        this.reconnected.emit();
      } catch {
        this.reconnectMs = Math.min(this.reconnectMs * 2, MAX_RECONNECT_MS);
        this.scheduleReconnect();
      }
    }, this.reconnectMs);
  }

  // ── Sends ──────────────────────────────────────────────────────────────

  async joinMatch(
    matchId: string,
    metadata?: Record<string, string>,
  ): Promise<KalpixMatch> {
    this.assertConnected();
    const env = await this.requestWithCid(
      {
        type: 'match_join',
        match_join: { match_id: matchId, metadata },
      },
      JOIN_TIMEOUT_MS,
      `joinMatch ${matchId}`,
    );
    const j = env.match_joined;
    if (!j) throw new KalpixError(13, 'Missing match_joined payload');
    return {
      matchId: j.match_id,
      self: j.self,
      presences: j.presences ?? [],
      label: j.label,
      size: j.size,
      tickRate: j.tick_rate,
    };
  }

  leaveMatch(matchId: string): void {
    if (!this.connected) return;
    this.sendRaw({
      type: 'match_leave',
      match_leave: { match_id: matchId },
    });
  }

  sendMatchData(matchId: string, opCode: number, data: Uint8Array): void {
    this.assertConnected();
    this.sendRaw({
      type: 'match_data',
      match_data: {
        match_id: matchId,
        op_code: opCode,
        data: bytesToBase64(data),
      },
    });
  }

  async matchSignal(matchId: string, data: string): Promise<string> {
    this.assertConnected();
    const env = await this.requestWithCid(
      { type: 'match_signal', match_signal: { match_id: matchId, data } },
      SIGNAL_TIMEOUT_MS,
      `matchSignal ${matchId}`,
    );
    return env.match_signal_response?.data ?? '';
  }

  /**
   * RPC over the websocket. The server replies with a `rpc_response` envelope
   * whose `payload` is a JSON-encoded `{success,error,data}` document.
   */
  async rpc<TRes = unknown, TReq = Record<string, unknown>>(
    functionId: string,
    payload: TReq,
  ): Promise<TRes> {
    this.assertConnected();
    const env = await this.requestWithCid(
      {
        type: 'rpc_request',
        rpc_request: { id: functionId, payload: JSON.stringify(payload) },
      },
      RPC_TIMEOUT_MS,
      `rpc ${functionId}`,
    );
    const raw = env.rpc_response?.payload;
    if (!raw) return {} as TRes;
    let parsed: RpcEnvelope<TRes>;
    try {
      parsed = JSON.parse(raw) as RpcEnvelope<TRes>;
    } catch {
      throw new KalpixError(13, `Malformed RPC payload for ${functionId}`);
    }
    if (parsed.error) {
      throw new KalpixError(parsed.error.code, parsed.error.message);
    }
    return (parsed.data ?? ({} as TRes)) as TRes;
  }

  async addMatchmakerTicket(req: {
    minCount: number;
    maxCount: number;
    query?: string;
    stringProperties?: Record<string, string>;
    numericProperties?: Record<string, number>;
  }): Promise<string> {
    this.assertConnected();
    const env = await this.requestWithCid(
      {
        type: 'matchmaker_add',
        matchmaker_add: {
          min_count: req.minCount,
          max_count: req.maxCount,
          query: req.query,
          string_properties: req.stringProperties,
          numeric_properties: req.numericProperties,
        },
      },
      RPC_TIMEOUT_MS,
      'matchmaker_add',
    );
    // Backend pipeline.handleMatchmakerAdd replies with:
    //   { type: "rpc_response", cid, rpc_response: { id: "matchmaker_ticket",
    //     payload: "<ticket-id>" } }
    // (See kalpix-backend/internal/realtime/pipeline.go.) The payload is the
    // raw ticket string, not JSON. We accept either that shape or — for
    // forward compatibility — a matchmaker_matched envelope that carries the
    // ticket directly.
    const rpcId = env.rpc_response?.id;
    if (rpcId === 'matchmaker_ticket') {
      return env.rpc_response?.payload ?? '';
    }
    return env.matchmaker_matched?.ticket ?? '';
  }

  removeMatchmakerTicket(ticket: string): void {
    if (!this.connected) return;
    this.sendRaw({
      type: 'matchmaker_remove',
      matchmaker_remove: { ticket },
    });
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private async requestWithCid(
    env: Omit<Envelope, 'cid'>,
    timeoutMs: number,
    label: string,
  ): Promise<Envelope> {
    const cid = String(++this.cidCounter);
    return new Promise<Envelope>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(cid);
        reject(new KalpixTimeoutError(`${label} timed out`));
      }, timeoutMs);
      this.pending.set(cid, { resolve, reject, timer });
      this.sendRaw({ ...env, cid });
    });
  }

  private sendRaw(env: Envelope): void {
    if (!this.ws) throw new KalpixSocketError();
    this.ws.send(JSON.stringify(env));
  }

  private assertConnected(): void {
    if (!this.connected || !this.ws) throw new KalpixSocketError();
  }

  private failPending(reason: string): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new KalpixSocketError(reason));
    }
    this.pending.clear();
  }

  private handleIncoming(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let env: Envelope;
    try {
      env = JSON.parse(raw) as Envelope;
    } catch {
      return;
    }

    this.anyMessage.emit(env);
    const type: EnvelopeType = env.type;

    if (env.cid && this.pending.has(env.cid)) {
      const pending = this.pending.get(env.cid)!;
      this.pending.delete(env.cid);
      clearTimeout(pending.timer);

      if (type === 'error') {
        pending.reject(
          new KalpixError(
            env.error?.code ?? 13,
            env.error?.message ?? 'Unknown error',
          ),
        );
        return;
      }
      pending.resolve(env);
      return;
    }

    switch (type) {
      case 'match_data': {
        const md = env.match_data;
        if (!md) return;
        this.matchData.emit({
          matchId: md.match_id,
          opCode: md.op_code,
          data: base64ToBytes(md.data),
          presence: md.presence,
        });
        return;
      }
      case 'match_state': {
        const ms = env.match_state;
        if (!ms) return;
        this.matchState.emit({
          matchId: ms.match_id,
          tick: ms.tick,
          state: ms.state ? base64ToBytes(ms.state) : new Uint8Array(0),
          presences: ms.presences ?? [],
          label: ms.label,
        });
        return;
      }
      case 'match_presence_event': {
        const mp = env.match_presence_event;
        if (!mp) return;
        this.matchPresence.emit({
          matchId: mp.match_id,
          joins: mp.joins ?? [],
          leaves: mp.leaves ?? [],
        });
        return;
      }
      default:
        return;
    }
  }
}

// Browser-safe base64 helpers (atob/btoa handle binary as latin-1).
function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
