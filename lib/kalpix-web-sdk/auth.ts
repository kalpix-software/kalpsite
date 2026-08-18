// Token acquisition for the web SDK.
//
// Two delivery modes:
//   1. URL fragment from Flutter webview: `#token=<jwt>&uid=<id>` — read once,
//      stash in memory, then `history.replaceState` to wipe the hash so the
//      JWT does not linger in browser history.
//   2. Standalone web (kalpsite browser session): cookie / localStorage flow
//      managed by the host page; pass the token in via `setSession`.

export interface KalpixSession {
  token: string;
  userId?: string;
  expiresAtMs?: number; // optional client-side expiry hint
}

export interface AuthBridge {
  /** Refresh callback. On Flutter webview, calls a registered JS handler. */
  refresh(): Promise<KalpixSession | null>;
}

export interface FlutterInAppWebView {
  callHandler<T = unknown>(name: string, ...args: unknown[]): Promise<T>;
}

declare global {
  interface Window {
    flutter_inappwebview?: FlutterInAppWebView;
  }
}

export class SessionStore {
  private session: KalpixSession | null = null;
  private listeners = new Set<(s: KalpixSession | null) => void>();

  get current(): KalpixSession | null {
    return this.session;
  }

  set(session: KalpixSession | null): void {
    this.session = session;
    for (const l of this.listeners) l(session);
  }

  subscribe(fn: (s: KalpixSession | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

const DEV_SESSION_KEY = 'kalpix.devSession.v1';

/**
 * Read `#token=…&uid=…` from the URL fragment, populate the store, then wipe
 * the fragment via `history.replaceState`. Returns true if a token was found.
 *
 * Dev convenience: when running outside a Flutter webview (no
 * `window.flutter_inappwebview`), the consumed fragment is cached in
 * `sessionStorage` so `next dev` hot-reloads don't drop the session. The
 * cache is per-tab and cleared by closing the tab. In production webview
 * mode the cache is never written or read.
 */
export function consumeUrlFragment(store: SessionStore): boolean {
  if (typeof window === 'undefined') return false;

  const inWebview = !!window.flutter_inappwebview;
  const hash = window.location.hash.replace(/^#/, '');

  if (hash) {
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    if (token) {
      const session: KalpixSession = {
        token,
        userId: params.get('uid') ?? undefined,
      };
      store.set(session);
      if (!inWebview) {
        try {
          window.sessionStorage.setItem(DEV_SESSION_KEY, JSON.stringify(session));
        } catch {}
      }
      const cleanUrl =
        window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanUrl);
      return true;
    }
  }

  if (!inWebview) {
    try {
      const raw = window.sessionStorage.getItem(DEV_SESSION_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as KalpixSession;
        if (cached.token) {
          store.set(cached);
          return true;
        }
      }
    } catch {}
  }

  return false;
}

/** Refresh handler that delegates to the Flutter `kalpix_refresh_token` JS handler. */
export function flutterBridgeRefresh(): AuthBridge {
  return {
    async refresh() {
      const bridge =
        typeof window !== 'undefined' ? window.flutter_inappwebview : undefined;
      if (!bridge) return null;
      const token = await bridge.callHandler<string | null>(
        'kalpix_refresh_token',
      );
      if (!token) return null;
      return { token };
    },
  };
}

/**
 * Ask the Flutter host for the current session via the `kalpix_session` JS
 * handler. Used as a fallback when the URL fragment didn't carry a token —
 * iOS WKWebView is known to drop fragments under some `URLRequest` paths,
 * so this is the more reliable bootstrap path inside a webview.
 *
 * Returns true if a session was successfully loaded.
 */
export async function bridgeBootstrapSession(store: SessionStore): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const bridge = window.flutter_inappwebview;
  if (!bridge) return false;
  if (store.current?.token) return true;
  try {
    const result = await bridge.callHandler<{ token?: string; userId?: string } | null>(
      'kalpix_session',
    );
    if (!result?.token) return false;
    store.set({ token: result.token, userId: result.userId });
    return true;
  } catch {
    return false;
  }
}
