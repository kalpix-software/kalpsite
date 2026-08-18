/**
 * Which Kalpix environment this kalpsite process administers.
 *
 * The environment is derived from KALPIX_API_URL rather than being a separate
 * flag, and the R2 target is validated against it. That is deliberate.
 *
 * An admin upload is not a standalone action: kalpsite writes the file to R2
 * *and* records the resulting URL through the backend. If the bucket could be
 * chosen independently of the backend, you would get a row in the staging
 * database pointing at a production asset — or a production row pointing at a
 * staging asset that nobody outside the VPN can load. Neither raises an error;
 * both are discovered weeks later as "some images don't work".
 *
 * So there is one switch, not five, and a mismatch fails at startup instead of
 * silently producing split data.
 */

export type KalpixEnv = 'production' | 'staging' | 'local';

interface EnvProfile {
  env: KalpixEnv;
  label: string;
  apiUrl: string;
  bucket: string;
  publicUrl: string;
}

/** Expected pairings. A config that satisfies none of these is a mistake. */
const EXPECTED: Record<Exclude<KalpixEnv, 'local'>, { apiHost: string; bucket: string; publicUrl: string }> = {
  production: {
    apiHost: 'api.kalpixsoftware.com',
    bucket: 'kalpix-production',
    publicUrl: 'https://assets.kalpixsoftware.com',
  },
  staging: {
    apiHost: 'staging-api.kalpixsoftware.com',
    bucket: 'kalpix-staging',
    publicUrl: 'https://staging-assets.kalpixsoftware.com',
  },
};

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

let cached: EnvProfile | null = null;

/**
 * Resolves and validates the active environment. Throws on an incoherent
 * config — better a refused boot than assets scattered across two buckets.
 */
export function getEnvironment(): EnvProfile {
  if (cached) return cached;

  const apiUrl = process.env.KALPIX_API_URL ?? '';
  const bucket = process.env.R2_BUCKET_NAME ?? '';
  const publicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
  const host = hostOf(apiUrl);

  // A local backend pairs with whichever bucket you point it at — that is a
  // development choice, so it is allowed but still surfaced in the UI.
  const isLocal =
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    /^\d+\.\d+\.\d+\.\d+/.test(host);

  if (isLocal) {
    cached = { env: 'local', label: `LOCAL → ${bucket || 'no bucket'}`, apiUrl, bucket, publicUrl };
    return cached;
  }

  const match = (Object.keys(EXPECTED) as Array<keyof typeof EXPECTED>).find(
    (k) => EXPECTED[k].apiHost === host,
  );

  if (!match) {
    throw new Error(
      `[kalpsite] KALPIX_API_URL host "${host}" is not a known environment. ` +
        `Expected one of: ${Object.values(EXPECTED).map((e) => e.apiHost).join(', ')}, or a local address.`,
    );
  }

  const want = EXPECTED[match];
  const problems: string[] = [];
  if (bucket !== want.bucket) {
    problems.push(`R2_BUCKET_NAME is "${bucket || '(unset)'}" but ${match} requires "${want.bucket}"`);
  }
  if (publicUrl !== want.publicUrl) {
    problems.push(`R2_PUBLIC_URL is "${publicUrl || '(unset)'}" but ${match} requires "${want.publicUrl}"`);
  }

  if (problems.length) {
    throw new Error(
      `[kalpsite] Environment mismatch — refusing to start.\n` +
        `  API points at ${match} (${host})\n` +
        problems.map((p) => `  ${p}\n`).join('') +
        `Uploading with this config would put assets in one environment and their ` +
        `database records in another. Fix .env.${match} and restart.`,
    );
  }

  cached = { env: match, label: match.toUpperCase(), apiUrl, bucket, publicUrl };
  return cached;
}

/** Safe for render paths: reports the problem instead of throwing mid-tree. */
export function describeEnvironment(): { env: KalpixEnv | 'misconfigured'; label: string; detail?: string } {
  try {
    const p = getEnvironment();
    return { env: p.env, label: p.label, detail: `${p.bucket} · ${hostOf(p.apiUrl)}` };
  } catch (e) {
    return { env: 'misconfigured', label: 'MISCONFIGURED', detail: (e as Error).message };
  }
}
