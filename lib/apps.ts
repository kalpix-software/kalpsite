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
  /** Android application id, e.g. "com.kalpix.plak". */
  androidPackage: string;
  /** SHA-256 signing-cert fingerprint(s) from Play Console -> App signing.
   *  Colon-separated upper-case hex, e.g. "AA:BB:CC:...". */
  androidFingerprints: string[];
  /** iOS app id as "<TeamID>.<BundleID>", e.g. "ABCDE12345.com.kalpix.plak". */
  iosAppId: string;
  /** Store URLs for the "app not installed" fallback buttons. */
  playUrl: string;
  appStoreUrl: string;
  /** Backend base URL used to resolve invite previews (no trailing slash). */
  apiBase: string;
};

export const APPS: Record<string, AppConfig> = {
  'plak.kalpixsoftware.com': {
    name: 'Plak',
    androidPackage: 'com.kalpixsoftware.plak',
    // SHA-256 of every certificate that may sign the app. Android accepts the
    // link if ANY listed fingerprint matches, so an extra entry is harmless
    // while a missing one silently breaks deep links.
    //
    // [0] plak-upload-keystore.jks, alias "Plak", created 15 Aug 2026. This is
    //     the certificate for builds you install directly (internal testing,
    //     sideloaded APKs).
    // [1] carried over from the previous setup and unverified. Once the app is
    //     created in Play Console, REPLACE it with the Play App Signing
    //     certificate from Setup > App signing — Play re-signs the app with its
    //     own key, and that is the certificate real installs actually carry.
    androidFingerprints: ["51:B2:AE:5B:69:75:37:3B:9D:2F:6A:60:28:4F:A6:F7:2F:16:B4:DF:03:37:34:99:15:45:75:FC:4B:B5:24:00",
        "60:8D:1E:8A:EC:9D:A4:C6:E9:34:65:E6:01:09:B2:08:96:03:47:94:61:82:AF:A9:27:6F:B9:C7:26:3A:1C:47"],
    // ── STILL TO FILL ────────────────────────────────────────────────
    iosAppId: 'REPLACE_ME_TEAMID.com.kalpixsoftware.plak', // <TeamID>.<BundleID>
    appStoreUrl: 'https://apps.apple.com/app/idREPLACE_ME', // App Store listing
    // ─────────────────────────────────────────────────────────────────
    playUrl: 'https://play.google.com/store/apps/details?id=com.kalpixsoftware.plak',
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
