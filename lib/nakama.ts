/**
 * Nakama API client for admin operations.
 * Kalpsite admin uses the Game API only: login obtains a game session for the admin user,
 * and admin RPCs call the game server with that token. No Nakama Console credentials are used.
 */

interface NakamaErrorBody {
  message?: string;
  error?: string | { message?: string };
  code?: number;
}

interface NakamaRpcResponse {
  success?: boolean;
  error?: unknown;
  data?: unknown;
  payload?: string;
}

export interface AuthResult {
  token: string;
}

// Single base URL for both authenticated RPCs (/v2/rpc) and unauthenticated auth
// RPCs exposed via Nginx (/api/v1/*). In production this should point at your
// host-level Nginx, e.g. http://api.kalpixsoftware.com.
const NAKAMA_URL = process.env.NAKAMA_URL || 'http://127.0.0.1:80';

/** Normalize API error to a string (backend may return error as { code, message }). */
function errorMessage(data: unknown, fallback: string): string {
  if (data == null) return fallback;
  const obj = data as NakamaErrorBody;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (obj.error && typeof obj.error === 'object' && typeof obj.error.message === 'string') {
    return obj.error.message;
  }
  return fallback;
}

/**
 * Call a game RPC with a game session token (Bearer). Used by Kalpsite admin after login.
 * The token must be for a game user with is_admin in metadata; the backend enforces that.
 */
export async function gameRpc(token: string, rpcId: string, payload: string): Promise<unknown> {
  const url = `${NAKAMA_URL.replace(/\/$/, '')}/v2/rpc/${rpcId}?unwrap`;
  const body = payload?.trim() || '{}';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  const data: NakamaRpcResponse = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorMessage(data, `RPC failed: ${res.status}`));
  }
  if (typeof data.success === 'boolean' && !data.success) {
    throw new Error(errorMessage(data.error, 'RPC returned success: false'));
  }
  return data.data ?? data;
}

/**
 * Login using the game backend's auth/login_email RPC (same flow as Plazy/Postman).
 * Calls the public /api/v1/auth/login_email endpoint exposed by Nginx and returns
 * the same session token the game uses.
 */
export async function loginWithGameAuth(email: string, password: string): Promise<AuthResult> {
  const data = (await serverRpc('auth/login_email', {
    email,
    password,
    deviceId: 'kalpsite-admin',
    platform: 'web',
    deviceName: 'Kalpsite Admin',
  })) as { sessionToken?: string };
  const token = typeof data?.sessionToken === 'string' ? data.sessionToken.trim() : '';
  if (!token) {
    throw new Error('Game server did not return a session token');
  }
  return { token };
}

/**
 * Call an unauthenticated auth RPC via Nginx (/api/v1/*). Used for register_email,
 * verify_registration_otp, etc.
 */
export async function serverRpc(rpcId: string, payload: Record<string, unknown>): Promise<unknown> {
  const base = (NAKAMA_URL || '').replace(/\/$/, '');
  if (!base) {
    throw new Error('NAKAMA_URL is not set; cannot call unauthenticated auth RPCs');
  }
  const url = `${base}/api/v1/${rpcId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data: NakamaRpcResponse = await res.json().catch(() => ({}));
  if (typeof data.payload === 'string') {
    try {
      data = JSON.parse(data.payload) as NakamaRpcResponse;
    } catch {
      // keep data as-is
    }
  }
  if (!res.ok) {
    throw new Error(errorMessage(data, `RPC failed: ${res.status}`));
  }
  if (typeof data.success === 'boolean' && !data.success) {
    throw new Error(errorMessage(data.error, 'RPC returned success: false'));
  }
  return data.data ?? data;
}
