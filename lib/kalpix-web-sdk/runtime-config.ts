// Runtime config resolution for the chess SPA.
//
// Order of precedence for picking the backend host:
//   1. URL query parameter `?host=…` (and optional `?ssl=true|false`).
//      Lets a single kalpsite dev server serve both a real device on the
//      LAN AND an Android emulator at 10.0.2.2 from the same build by
//      passing different URLs from Flutter:
//        real device:      …/lobby?host=192.168.31.243:7350&ssl=false
//        Android emulator: …/lobby?host=10.0.2.2:7350&ssl=false
//        iOS simulator:    …/lobby?host=localhost:7350&ssl=false
//   2. NEXT_PUBLIC_KALPIX_HOST / NEXT_PUBLIC_KALPIX_SSL env vars.
//   3. Built-in default (api.kalpixgames.com / SSL on).
//
// Once the URL form is consumed, the values are cached in sessionStorage
// for that tab so reloads keep the override.

const CACHE_KEY = 'kalpix.runtimeHost.v1';

interface RuntimeHost {
  host: string;
  ssl: boolean;
}

const ENV_HOST = process.env.NEXT_PUBLIC_KALPIX_HOST ?? 'api.kalpixgames.com';
const ENV_SSL = (process.env.NEXT_PUBLIC_KALPIX_SSL ?? 'true') !== 'false';

export function resolveRuntimeHost(): RuntimeHost {
  if (typeof window === 'undefined') {
    return { host: ENV_HOST, ssl: ENV_SSL };
  }

  const params = new URLSearchParams(window.location.search);
  const queryHost = params.get('host');
  const querySsl = params.get('ssl');

  if (queryHost) {
    const cfg: RuntimeHost = {
      host: queryHost,
      ssl: querySsl === null ? ENV_SSL : querySsl === 'true',
    };
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
    } catch {}
    return cfg;
  }

  try {
    const cached = window.sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as RuntimeHost;
      if (parsed.host) return parsed;
    }
  } catch {}

  return { host: ENV_HOST, ssl: ENV_SSL };
}
