/**
 * Nakama API client for admin operations.
 * Kalpsite admin uses the Game API only: login obtains a game session for the admin user,
 * and admin RPCs call the game server with that token. No Nakama Console credentials are used.
 */

const NAKAMA_URL = process.env.NAKAMA_URL || 'http://127.0.0.1:7350';
const NAKAMA_SERVER_KEY = process.env.NAKAMA_SERVER_KEY || 'defaultkey';
// For unauthenticated RPCs (register_email, verify_registration_otp). Nakama uses runtime.http_key (default: defaulthttpkey).
// Set NAKAMA_HTTP_KEY or NAKAMA_RUNTIME_HTTP_KEY to match the backend; if unset, falls back to NAKAMA_SERVER_KEY.
const NAKAMA_HTTP_KEY =
  process.env.NAKAMA_HTTP_KEY ||
  process.env.NAKAMA_RUNTIME_HTTP_KEY ||
  NAKAMA_SERVER_KEY;

/** Validate a game session token by calling the game API /v2/account. */
export async function validateGameSession(token: string): Promise<boolean> {
  const url = `${NAKAMA_URL.replace(/\/$/, '')}/v2/account`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

/** Normalize API error to a string (backend may return error as { code, message }). */
function errorMessage(data: unknown, fallback: string): string {
  if (data == null) return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (obj.error && typeof obj.error === 'object' && typeof (obj.error as Record<string, unknown>).message === 'string') {
    return (obj.error as Record<string, string>).message;
  }
  return fallback;
}

/**
 * Call a game RPC with a game session token (Bearer). Used by Kalpsite admin after login.
 * The token must be for a game user with is_admin in metadata; the backend enforces that.
 */
export async function gameRpc(token: string, rpcId: string, payload: string): Promise<unknown> {
  const url = `${NAKAMA_URL.replace(/\/$/, '')}/v2/rpc/${rpcId}?unwrap`;
  // Send payload as raw body (e.g. "{}" or '{"key":"value"}'); do not JSON.stringify the string or backend gets "Invalid request payload"
  const body = payload?.trim() || '{}';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorMessage(data, `RPC failed: ${res.status}`));
  }
  const success = (data as { success?: boolean }).success;
  if (typeof success === 'boolean' && !success) {
    const err = (data as { error?: unknown }).error;
    throw new Error(errorMessage(err, 'RPC returned success: false'));
  }
  return (data as { data?: unknown }).data ?? data;
}

export async function authenticateEmail(email: string, password: string): Promise<{ token: string }> {
  const basicAuth = Buffer.from(`${NAKAMA_SERVER_KEY}:`).toString('base64');
  const res = await fetch(`${NAKAMA_URL}/v2/account/authenticate/email?create=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || `Auth failed: ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  // Nakama may return "token" or "session_token"; handle nested "data" too
  const raw = data.token ?? data.session_token ?? (data.data && typeof data.data === 'object' && (data.data as Record<string, unknown>).token) ?? (data.data && typeof data.data === 'object' && (data.data as Record<string, unknown>).session_token);
  const token = typeof raw === 'string' ? raw : '';
  return { token };
}

/**
 * Call a game RPC with server key (http_key). Used for unauthenticated flows e.g. register_email, verify_registration_otp.
 * Same as: POST {{base_url}}/v2/rpc/{rpcId}?unwrap&http_key={{server_key}}
 */
export async function serverRpc(rpcId: string, payload: Record<string, unknown>): Promise<unknown> {
  const baseUrl = NAKAMA_URL.replace(/\/$/, '');
  const url = `${baseUrl}/v2/rpc/${rpcId}?unwrap&http_key=${encodeURIComponent(NAKAMA_HTTP_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = await res.json().catch(() => ({})) as Record<string, unknown>;
  // Nakama may return RPC result in .payload (JSON string) or .data
  if (typeof data.payload === 'string') {
    try {
      data = JSON.parse(data.payload) as Record<string, unknown>;
    } catch {
      // keep data as-is
    }
  }
  if (!res.ok) {
    throw new Error(errorMessage(data, `RPC failed: ${res.status}`));
  }
  const success = data.success;
  if (typeof success === 'boolean' && !success) {
    throw new Error(errorMessage(data.error, 'RPC returned success: false'));
  }
  return data.data ?? data;
}

/** Game API RPC (Bearer = game session token). Kept for non-admin use if needed. */
export async function rpc(session: string, rpcId: string, payload: string = '') {
  const res = await fetch(`${NAKAMA_URL}/v2/rpc/${rpcId}?unwrap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session}`,
    },
    body: JSON.stringify(payload || ''),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `RPC failed: ${res.status}`);
  }
  const data = await res.json();
  if (data && typeof data.payload === 'string') {
    try {
      return JSON.parse(data.payload);
    } catch {
      return data;
    }
  }
  return data;
}
