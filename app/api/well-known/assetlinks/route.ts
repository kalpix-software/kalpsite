import { NextResponse } from 'next/server';
import { appForHost } from '@/lib/apps';

// Android App Links verification file. Served (via rewrite in next.config.js) at:
//   https://<host>/.well-known/assetlinks.json
// Content is host-specific, so Android gets the right package + fingerprints
// for whichever app subdomain it fetched.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const app = appForHost(request.headers.get('host'));
  if (!app) {
    return new NextResponse('Not found', { status: 404 });
  }

  // One statement per package. Android cannot be served a tailored file — the
  // verifier's GET names neither the package nor the certificate — so every app
  // allowed on this host is listed and each one finds its own entry.
  const body = app.androidPackages.map((packageName) => ({
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: app.androidFingerprints,
    },
  }));

  return NextResponse.json(body, {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
    },
  });
}
