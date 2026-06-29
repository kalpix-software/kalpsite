/**
 * Kalpix API client for admin operations.
 * Kalpsite admin uses the Game API only: login obtains a game session for the admin user,
 * and admin RPCs call the game server with that token.
 */

interface ApiErrorBody {
  message?: string;
  error?: string | { message?: string };
  code?: number;
}

interface ApiRpcResponse {
  success?: boolean;
  error?: unknown;
  data?: unknown;
  payload?: string;
}

export interface AuthResult {
  token: string;
  isAdmin?: boolean;
  /** True when the account has 2FA enabled and a valid TOTP code is still needed. */
  totpRequired?: boolean;
}

// Backend gateway URL. Set KALPIX_API_URL per environment:
// - Local: .env.local with KALPIX_API_URL=http://localhost
// - Production: KALPIX_API_URL=https://api.kalpixsoftware.com (e.g. in Vercel env)
const API_URL = process.env.KALPIX_API_URL || 'http://localhost';

/** Normalize API error to a string (backend may return error as { code, message }). */
function errorMessage(data: unknown, fallback: string): string {
  if (data == null) return fallback;
  const obj = data as ApiErrorBody;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (obj.error && typeof obj.error === 'object' && typeof obj.error.message === 'string') {
    return obj.error.message;
  }
  return fallback;
}

/**
 * Call a game RPC with a game session token (Bearer). Uses the /api/v1/ path.
 */
export async function gameRpc(token: string, rpcId: string, payload: string): Promise<unknown> {
  const base = (API_URL || '').replace(/\/$/, '');
  if (!base) {
    throw new Error('KALPIX_API_URL is not set');
  }
  const url = `${base}/api/v1/${rpcId}`;
  const body = payload?.trim() || '{}';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  let data: ApiRpcResponse = await res.json().catch(() => ({}));
  if (typeof data.payload === 'string') {
    try {
      data = JSON.parse(data.payload) as ApiRpcResponse;
    } catch {
      // keep as-is
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

/**
 * Admin login via the game backend's auth/admin_login_email RPC. This is a
 * separate, admin-only path from the shared mobile auth/login_email: the backend
 * enforces is_admin and, when enrolled, TOTP 2FA.
 *
 * Pass totpCode on the second call once the user has entered their 6-digit code
 * (or a backup recovery code). When 2FA is enabled and no code is supplied yet,
 * the backend responds with { totpRequired: true } and no session token.
 */
export async function loginWithGameAuth(
  email: string,
  password: string,
  totpCode?: string
): Promise<AuthResult> {
  const data = (await serverRpc('auth/admin_login_email', {
    email,
    password,
    totpCode: totpCode ?? '',
    deviceId: 'kalpsite-admin',
    platform: 'web',
    deviceName: 'Kalpsite Admin',
  })) as {
    sessionToken?: string;
    isAdmin?: boolean;
    totpRequired?: boolean;
    profile?: { isAdmin?: boolean; metadata?: { isAdmin?: boolean } };
  };

  // 2FA is enabled but no (valid) code was provided yet — caller must prompt.
  if (data?.totpRequired === true) {
    return { token: '', totpRequired: true };
  }

  const token = typeof data?.sessionToken === 'string' ? data.sessionToken.trim() : '';
  if (!token) {
    throw new Error('Game server did not return a session token');
  }
  // Admin flag lives at profile.metadata.isAdmin in the live backend
  // response. Older code paths may surface it at the top level or at
  // profile.isAdmin — accept any of those so this stays robust if the
  // backend ever flattens the shape.
  const isAdmin =
    data?.isAdmin === true ||
    data?.profile?.isAdmin === true ||
    data?.profile?.metadata?.isAdmin === true;
  return { token, isAdmin };
}

/**
 * Call an unauthenticated auth RPC via /api/v1/*. Used for register_email,
 * verify_registration_otp, etc.
 */
export async function serverRpc(rpcId: string, payload: Record<string, unknown>): Promise<unknown> {
  const base = (API_URL || '').replace(/\/$/, '');
  if (!base) {
    throw new Error('KALPIX_API_URL is not set; cannot call unauthenticated auth RPCs');
  }
  const url = `${base}/api/v1/${rpcId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data: ApiRpcResponse = await res.json().catch(() => ({}));
  if (typeof data.payload === 'string') {
    try {
      data = JSON.parse(data.payload) as ApiRpcResponse;
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
