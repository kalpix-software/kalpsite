import {
  bridgeBootstrapSession,
  consumeUrlFragment,
  flutterBridgeRefresh,
  SessionStore,
  type AuthBridge,
  type KalpixSession,
} from './auth';
import {
  resolveConfig,
  type KalpixConfig,
  type ResolvedConfig,
} from './config';
import { KalpixHttp } from './rpc';
import { KalpixSocket } from './socket';

export interface KalpixClientOptions {
  config: KalpixConfig;
  /** Defaults to the Flutter webview bridge. Pass null to disable refresh. */
  authBridge?: AuthBridge | null;
  /** If true, read `#token=…` from `location.hash` on construction. */
  consumeFragment?: boolean;
}

/**
 * Web counterpart to the Dart `KalpixClient`. One instance per page (the
 * webview is the page). Holds the singleton socket + http + session.
 */
export class KalpixClient {
  readonly cfg: ResolvedConfig;
  readonly session = new SessionStore();
  readonly http: KalpixHttp;
  readonly socket: KalpixSocket;
  private bridge: AuthBridge | null;

  constructor(opts: KalpixClientOptions) {
    this.cfg = resolveConfig(opts.config);
    this.bridge =
      opts.authBridge === undefined ? flutterBridgeRefresh() : opts.authBridge;
    this.http = new KalpixHttp(this.cfg, this.session, this.bridge);
    this.socket = new KalpixSocket(this.cfg, this.session);

    if (opts.consumeFragment !== false) {
      consumeUrlFragment(this.session);
    }
  }

  setSession(session: KalpixSession | null): void {
    this.session.set(session);
  }

  /**
   * Resolve the session from any available source: URL fragment (already
   * consumed in the constructor), dev sessionStorage cache, or — inside a
   * Flutter webview — the `kalpix_session` JS handler. Idempotent.
   *
   * Call this in your page's `useEffect` before deciding the user is
   * unauthenticated.
   */
  async bootstrapSession(): Promise<KalpixSession | null> {
    if (!this.session.current) {
      await bridgeBootstrapSession(this.session);
    }
    return this.session.current;
  }

  /** Convenience: connect the websocket if a session is present. */
  async connect(): Promise<void> {
    if (!this.session.current) return;
    if (this.socket.isConnected) return;
    await this.socket.connect();
  }

  dispose(): void {
    this.socket.disconnect();
  }
}

export * from './types';
export * from './errors';
export * from './auth';
export * from './match';
export * from './matchmaker';
export { KalpixSocket } from './socket';
export { KalpixHttp } from './rpc';
export type { KalpixConfig } from './config';
export { resolveRuntimeHost } from './runtime-config';
