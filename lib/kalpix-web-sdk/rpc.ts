import { buildRpcUrl, type ResolvedConfig } from './config';
import type { AuthBridge, SessionStore } from './auth';
import {
  KalpixError,
  KalpixSessionExpiredError,
} from './errors';
import type { RpcEnvelope } from './types';

export class KalpixHttp {
  constructor(
    private cfg: ResolvedConfig,
    private session: SessionStore,
    private bridge: AuthBridge | null,
  ) {}

  async callPublic<TRes, TReq = Record<string, unknown>>(
    functionId: string,
    payload: TReq,
  ): Promise<TRes> {
    const res = await this.fetch(functionId, payload, undefined);
    return this.unwrap<TRes>(res, functionId);
  }

  async call<TRes, TReq = Record<string, unknown>>(
    functionId: string,
    payload: TReq,
  ): Promise<TRes> {
    const session = this.session.current;
    if (!session) throw new KalpixSessionExpiredError('No session token');

    let res: Response;
    try {
      res = await this.fetch(functionId, payload, session.token);
    } catch (e) {
      throw e;
    }

    if (res.status === 401) {
      const refreshed = await this.bridge?.refresh();
      if (!refreshed) throw new KalpixSessionExpiredError();
      this.session.set(refreshed);
      res = await this.fetch(functionId, payload, refreshed.token);
    }

    return this.unwrap<TRes>(res, functionId);
  }

  private async fetch(
    functionId: string,
    payload: unknown,
    token: string | undefined,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.requestTimeoutMs);
    try {
      return await fetch(buildRpcUrl(this.cfg, functionId), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async unwrap<TRes>(res: Response, functionId: string): Promise<TRes> {
    let body: RpcEnvelope<TRes>;
    try {
      body = (await res.json()) as RpcEnvelope<TRes>;
    } catch {
      throw new KalpixError(
        13,
        `RPC ${functionId} returned non-JSON (status ${res.status})`,
      );
    }
    if (!res.ok) {
      const e = body.error;
      throw new KalpixError(e?.code ?? 13, e?.message ?? `HTTP ${res.status}`);
    }
    if (body.error) throw new KalpixError(body.error.code, body.error.message);
    return (body.data ?? ({} as TRes)) as TRes;
  }
}
