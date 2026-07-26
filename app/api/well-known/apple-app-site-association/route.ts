import { NextResponse } from 'next/server';
import { appForHost } from '@/lib/apps';

// iOS Universal Links association file. Served (via rewrite in next.config.js) at:
//   https://<host>/.well-known/apple-app-site-association
// MUST be application/json with no extension and no redirect. Scoped to /i/*,
// /p/* and /r/* so only share links open the app — the rest of the host stays
// web.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const app = appForHost(request.headers.get('host'));
  if (!app) {
    return new NextResponse('Not found', { status: 404 });
  }

  const body = {
    applinks: {
      details: [
        {
          appIDs: [app.iosAppId],
          components: [
            { '/': '/i/*', comment: 'Group invite links' },
            { '/': '/p/*', comment: 'Profile share links' },
            { '/': '/r/*', comment: 'Refer and Earn links' },
          ],
        },
      ],
    },
  };

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
    },
  });
}
