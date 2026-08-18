// Wire types mirrored from kalpix-backend/internal/protocol/messages.go.
// Keep field names and casing aligned with the Go JSON tags.

export type EnvelopeType =
  | 'ping'
  | 'pong'
  | 'error'
  | 'rpc_request'
  | 'rpc_response'
  | 'stream_data'
  | 'stream_presence_event'
  | 'notification'
  | 'match_join'
  | 'match_joined'
  | 'match_leave'
  | 'match_data'
  | 'match_presence_event'
  | 'match_state'
  | 'presence_update'
  | 'status_update'
  | 'match_signal'
  | 'match_signal_response'
  | 'matchmaker_add'
  | 'matchmaker_remove'
  | 'matchmaker_matched';

export interface UserPresence {
  user_id: string;
  session_id: string;
  username: string;
  status?: string;
}

export interface ErrorPayload {
  code: number;
  message: string;
}

export interface RpcRequest {
  id: string;
  payload?: string;
}

export interface RpcResponseWire {
  id: string;
  payload?: string;
}

export interface MatchJoin {
  match_id: string;
  token?: string;
  metadata?: Record<string, string>;
}

export interface MatchJoined {
  match_id: string;
  self: UserPresence;
  presences: UserPresence[];
  label?: string;
  size: number;
  tick_rate: number;
}

export interface MatchLeave {
  match_id: string;
}

export interface MatchDataWire {
  match_id: string;
  op_code: number;
  data: string; // base64
  reliable?: boolean;
  presence?: UserPresence;
}

export interface MatchPresenceEventWire {
  match_id: string;
  joins?: UserPresence[];
  leaves?: UserPresence[];
}

export interface MatchStateWire {
  match_id: string;
  presences: UserPresence[];
  tick: number;
  state?: string; // base64
  label?: string;
}

export interface MatchSignal {
  match_id: string;
  data: string;
}

export interface MatchSignalResponse {
  data?: string;
}

export interface MatchmakerAdd {
  min_count: number;
  max_count: number;
  query?: string;
  string_properties?: Record<string, string>;
  numeric_properties?: Record<string, number>;
}

export interface MatchmakerRemove {
  ticket: string;
}

export interface MatchmakerUser {
  presence: UserPresence;
  string_properties?: Record<string, string>;
  numeric_properties?: Record<string, number>;
}

export interface MatchmakerMatched {
  ticket: string;
  match_id: string;
  token?: string;
  users?: MatchmakerUser[];
  self?: MatchmakerUser;
}

export interface NotificationItem {
  id: string;
  subject: string;
  content: Record<string, unknown>;
  code: number;
  sender_id: string;
  create_time: number;
  persistent: boolean;
}

export interface Envelope {
  cid?: string;
  type: EnvelopeType;
  ping?: Record<string, never>;
  pong?: Record<string, never>;
  error?: ErrorPayload;
  rpc_request?: RpcRequest;
  rpc_response?: RpcResponseWire;
  match_join?: MatchJoin;
  match_joined?: MatchJoined;
  match_leave?: MatchLeave;
  match_data?: MatchDataWire;
  match_presence_event?: MatchPresenceEventWire;
  match_state?: MatchStateWire;
  match_signal?: MatchSignal;
  match_signal_response?: MatchSignalResponse;
  matchmaker_add?: MatchmakerAdd;
  matchmaker_remove?: MatchmakerRemove;
  matchmaker_matched?: MatchmakerMatched;
  notification?: { notifications: NotificationItem[] };
  stream_data?: { data: string; sender?: UserPresence; reliable?: boolean };
}

// Decoded forms surfaced to consumers.

export interface KalpixMatchData {
  matchId: string;
  opCode: number;
  data: Uint8Array;
  presence?: UserPresence;
}

export interface KalpixMatchState {
  matchId: string;
  tick: number;
  state: Uint8Array;
  presences: UserPresence[];
  label?: string;
}

export interface KalpixMatchPresenceEvent {
  matchId: string;
  joins: UserPresence[];
  leaves: UserPresence[];
}

export interface KalpixMatch {
  matchId: string;
  self: UserPresence;
  presences: UserPresence[];
  label?: string;
  size: number;
  tickRate: number;
}

// Standard backend RPC response: {success, error, data}.
export interface RpcEnvelope<T = unknown> {
  success?: boolean;
  error?: { code: number; message: string };
  data?: T;
}

export const ErrorCodes = {
  Authentication: 16,
  Internal: 13,
  NotFound: 5,
  PermissionDenied: 7,
  AlreadyExists: 6,
  Unavailable: 14,
} as const;
