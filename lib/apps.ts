// Per-app deep-link config. THIS IS THE ONLY FILE YOU MAINTAIN for app links.
//
// To add a new app (e.g. app2.kalpixsoftware.com):
//   1. Add a block below keyed by its exact host.
//   2. Add that subdomain to this Vercel project (Settings -> Domains).
//   3. Add a Cloudflare CNAME: <sub> -> cname.vercel-dns.com (DNS only).
// No new project, no new code. The middleware + .well-known routes are
// host-driven from this registry.

export type AppConfig = {
  /** Display name shown on the invite landing page. */
  name: string;
  /** Android application id, e.g. "com.kalpix.plazy". */
  androidPackage: string;
  /** SHA-256 signing-cert fingerprint(s) from Play Console -> App signing.
   *  Colon-separated upper-case hex, e.g. "AA:BB:CC:...". */
  androidFingerprints: string[];
  /** iOS app id as "<TeamID>.<BundleID>", e.g. "ABCDE12345.com.kalpix.plazy". */
  iosAppId: string;
  /** Store URLs for the "app not installed" fallback buttons. */
  playUrl: string;
  appStoreUrl: string;
  /** Backend base URL used to resolve invite previews (no trailing slash). */
  apiBase: string;
};

export const APPS: Record<string, AppConfig> = {
  'plazy.kalpixsoftware.com': {
    name: 'Plazy',
    // ── FILL THESE 4 IN ──────────────────────────────────────────────
    androidPackage: 'com.kalpixgames.plazy', // e.g. com.kalpix.plazy
    androidFingerprints: ["69:CD:2A:C1:18:2B:8E:00:C7:11:ED:81:CE:2D:36:98:08:AE:A7:FF:DC:5E:10:17:8E:49:55:5B:AB:AF:14:46",
        "60:8D:1E:8A:EC:9D:A4:C6:E9:34:65:E6:01:09:B2:08:96:03:47:94:61:82:AF:A9:27:6F:B9:C7:26:3A:1C:47"], // Play Console > App signing
    iosAppId: 'REPLACE_ME_TEAMID.REPLACE_ME.bundle.id', // e.g. ABCDE12345.com.kalpix.plazy
    appStoreUrl: 'https://apps.apple.com/app/idREPLACE_ME', // App Store listing
    // ─────────────────────────────────────────────────────────────────
    playUrl: 'https://play.google.com/store/apps/details?id=com.kalpixgames.plazy',
    apiBase: 'https://api.kalpixsoftware.com',
  },

  // Future app — copy the block above, change the host key + values:
  // 'app2.kalpixsoftware.com': { ... },
};

/** Resolve the app config for an incoming request Host header (port-stripped). */
export function appForHost(host: string | null | undefined): AppConfig | null {
  if (!host) return null;
  const clean = host.split(':')[0].trim().toLowerCase();
  return APPS[clean] ?? null;
}

/** Hosts that should serve ONLY app-link content (invite pages + .well-known),
 *  not the main marketing site. */
export const LINK_HOSTS = new Set(Object.keys(APPS));
