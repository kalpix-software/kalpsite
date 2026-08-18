export interface KalpixConfig {
  host: string;
  port?: number;
  ssl?: boolean;
  requestTimeoutMs?: number;
  wsPathPrefix?: string;
}

export interface ResolvedConfig extends Required<KalpixConfig> {}

/**
 * Resolve user-supplied config into a normalized form. Accepts a `host` field
 * in any of these shapes:
 *   - "localhost"
 *   - "localhost:7350"
 *   - "http://localhost:7350"
 *   - "https://api.example.com"
 *   - "https://api.example.com:8443/some/prefix"
 *
 * Embedded scheme overrides `ssl` only when `ssl` was not explicitly set.
 * Embedded port overrides `port` only when `port` was not explicitly set.
 * Trailing path is discarded (URL builders own the path).
 */
export function resolveConfig(c: KalpixConfig): ResolvedConfig {
  let host = (c.host ?? '').trim();
  let port: number | undefined = c.port;
  let ssl: boolean | undefined = c.ssl;

  // Peel off a scheme if present.
  const schemeMatch = /^(https?):\/\//i.exec(host);
  let inferredSsl: boolean | undefined;
  if (schemeMatch) {
    inferredSsl = schemeMatch[1].toLowerCase() === 'https';
    host = host.slice(schemeMatch[0].length);
  }

  // Drop any path/query/fragment — host config carries only authority.
  const pathIdx = host.search(/[/?#]/);
  if (pathIdx >= 0) host = host.slice(0, pathIdx);

  // Peel off a port if present (but only when host is not bracketed IPv6).
  if (!host.startsWith('[')) {
    const colonIdx = host.lastIndexOf(':');
    if (colonIdx > 0) {
      const maybePort = Number.parseInt(host.slice(colonIdx + 1), 10);
      if (Number.isFinite(maybePort) && maybePort > 0) {
        if (port === undefined) port = maybePort;
        host = host.slice(0, colonIdx);
      }
    }
  }

  // Apply precedence: explicit ssl wins; otherwise inferred-from-scheme;
  // otherwise default to https.
  if (ssl === undefined) ssl = inferredSsl ?? true;
  if (port === undefined) port = ssl ? 443 : 80;

  return {
    host,
    port,
    ssl,
    requestTimeoutMs: c.requestTimeoutMs ?? 30_000,
    wsPathPrefix: c.wsPathPrefix ?? '',
  };
}

export function baseHttpUrl(c: ResolvedConfig): string {
  const scheme = c.ssl ? 'https' : 'http';
  const portSuffix =
    (c.ssl && c.port === 443) || (!c.ssl && c.port === 80) ? '' : `:${c.port}`;
  return `${scheme}://${c.host}${portSuffix}`;
}

export function baseWsUrl(c: ResolvedConfig): string {
  const scheme = c.ssl ? 'wss' : 'ws';
  const portSuffix =
    (c.ssl && c.port === 443) || (!c.ssl && c.port === 80) ? '' : `:${c.port}`;
  return `${scheme}://${c.host}${portSuffix}`;
}

export function buildRpcUrl(c: ResolvedConfig, functionId: string): string {
  return `${baseHttpUrl(c)}/api/v1/${functionId}`;
}

export function buildWsUrl(c: ResolvedConfig, token: string): string {
  return `${baseWsUrl(c)}${c.wsPathPrefix}/ws?token=${encodeURIComponent(token)}`;
}
